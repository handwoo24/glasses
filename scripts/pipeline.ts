// 파이프라인 도구. 에이전트는 Firestore에 직접 쓰지 않고 이 도구로 쓴다(양식·참조 검사).
// 사용법은 인자 없이 실행하면 나온다. 예: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npm run pipeline -- ls programs
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { checkFacts } from '#/pipeline/check'
import { PATH_HELP, resolve } from '#/pipeline/paths'
import type { Kind } from '#/pipeline/paths'
import { publish } from '#/pipeline/publish'
import { claim, done, enqueue, fail } from '#/pipeline/queue'
import { STAGES } from '#/pipeline/schemas'
import type { Stage } from '#/pipeline/schemas'
import { get, list, put } from '#/pipeline/store'
import { writeSnapshot } from '#/features/directory/server/snapshot.server'
import { readOrgWorklist } from '#/features/worklist/server/worklist.server'
import { readVendorWorklist } from '#/pipeline/vendor-worklist'

const USAGE = `사용법: npm run pipeline -- <명령>
  put <문서 경로> <파일.yaml|.json|.md> [--status draft|in-review|published]
  put-many <파일.jsonl>          한 줄에 {"path": 문서 경로, "value": 값} 하나. 양식·참조 검사는 put과 같다
  get <문서 경로>
  ls <컬렉션 경로>
  enqueue <단계> [평가 대상 경로] [--input <경로> ...]
  claim <단계> [--lease 분] [--subject 평가 대상 경로]
  done <작업 id> [산출물 경로 ...]
  fail <작업 id> <사유>
  check-facts <평가 대상 경로>   인용이 원문에 있는지, 자료 파일이 바뀌지 않았는지
  worklist <기관코드>            사업 카드마다 작업 단계(사이트 작업 현황과 같은 계산)
  publish <리포트 경로>          게시 대기(고친 뒤 마지막 검증 pass, check-facts 통과)인 판만 게시
                                업체 리포트(programs/…/vendors/…/reports/…)는 publishedVendors/{주소}로
  vendor-worklist [기관코드]     업체 루프 조사 목록: 업체 목록화가 남은 게시 사업과 업체 카드별 단계
  index                         목록 스냅샷을 다시 만든다. 기관·사업 카드·재정 문서·게시 문서를 쓰면 저절로 한다
단계: ${STAGES.join(', ')}
문서 경로:
  ${PATH_HELP.join('\n  ')}`

/** --이름 값 형태의 선택 인자를 뽑는다 */
function options(args: ReadonlyArray<string>) {
  const positional: Array<string> = []
  const named: Partial<Record<string, Array<string>>> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const v = args.at(i + 1)
      if (v === undefined) throw new Error(`${a} 다음에 값이 필요하다`)
      named[a.slice(2)] = [...(named[a.slice(2)] ?? []), v]
      i++
    } else positional.push(a)
  }
  return { positional, named }
}

/** 없으면 null로 찍는다 (JSON에 undefined가 없으므로) */
function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value
}

/** 파일 → 문서 값. .md는 리포트 한 판으로 읽는다 */
function readValue(file: string, status = 'draft'): unknown {
  const text = readFileSync(file, 'utf8')
  const ext = extname(file)
  if (ext === '.md')
    return { markdown: text, status, updatedAt: new Date().toISOString() }
  if (ext === '.json') return JSON.parse(text)
  if (ext === '.yaml' || ext === '.yml') return parseYaml(text)
  throw new Error(`읽을 수 없는 파일 형식: ${ext} (.yaml .json .md)`)
}

/**
 * 검증 시각이 지금보다 늦으면 거부한다. 작업 단계는 리포트 수정 시각과 검증 시각을 비교해 정하므로,
 * 한국 시각에 Z를 붙인 값이 들어가면 그 뒤에 고쳐도 몇 시간 동안 '고침'으로 남는다
 */
function notInFuture(value: unknown, field: string): void {
  const at =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)[field]
      : undefined
  if (typeof at !== 'string') return
  const skewMs = 2 * 60_000
  if (Date.parse(at) > Date.now() + skewMs)
    throw new Error(
      `${field}가 지금보다 늦다: ${at}. UTC 시각을 쓴다(date -u +%Y-%m-%dT%H:%M:%SZ)`,
    )
}

/** put-many에서 한꺼번에 쓰는 문서 수. 참조 검사 읽기와 쓰기가 몰리지 않게 */
const PUT_CONCURRENCY = 16

/** 예산 카탈로그처럼 수천 건을 쓸 때. 틀린 줄은 건너뛰지 않고 모두 모아 알린다 */
async function putMany(file: string) {
  const entries = readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      const { path, value } = JSON.parse(l) as {
        path?: unknown
        value?: unknown
      }
      if (typeof path !== 'string')
        throw new Error(`${i + 1}번째 줄에 path가 없다`)
      return { path, value }
    })
  // 같은 경로가 두 번 있으면 동시에 쓰는 순서에 따라 어느 값이 남을지 모른다
  const seen = new Set<string>()
  for (const { path } of entries) {
    if (seen.has(path)) throw new Error(`같은 경로가 두 번 있다: ${path}`)
    seen.add(path)
  }
  const failed: Array<{ path: string; error: string }> = []
  const written: Array<string> = []
  let next = 0
  const worker = async () => {
    while (next < entries.length) {
      const { path, value } = entries[next++]
      try {
        await put(path, value)
        written.push(path)
      } catch (e) {
        failed.push({ path, error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: PUT_CONCURRENCY }, worker))
  if (failed.length) process.exitCode = 1
  return {
    ok: failed.length === 0,
    written: written.length,
    listed: written.some(isListed),
    failed,
  }
}

/** 목록 스냅샷에 들어가는 문서 종류. 이것을 쓰면 스냅샷을 다시 만든다 */
const LISTED: ReadonlySet<Kind> = new Set([
  'org',
  'program',
  'budget',
  'published',
])

const isListed = (path: string) => LISTED.has(resolve(path).kind)

async function reindex() {
  const built = await writeSnapshot()
  process.stderr.write(
    `[index] 목록 스냅샷 ${built.version} (${built.chunks}조각, ${built.bytes}바이트)\n`,
  )
  return built
}

/** 문서는 이미 썼으므로 스냅샷이 실패해도 쓰기 결과는 그대로 알리고, 다시 만들 명령을 남긴다 */
async function reindexAfterWrite(): Promise<void> {
  try {
    await reindex()
  } catch (e) {
    process.exitCode = 1
    process.stderr.write(
      `[index] 문서는 썼지만 목록 스냅샷을 만들지 못했다. npm run pipeline -- index 로 다시 만든다: ${e instanceof Error ? e.message : String(e)}\n`,
    )
  }
}

function stage(value: string | undefined): Stage {
  if (!(STAGES as ReadonlyArray<string>).includes(value ?? ''))
    throw new Error(`단계는 ${STAGES.join(', ')} 중 하나`)
  return value as Stage
}

function print(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function run(argv: ReadonlyArray<string>): Promise<void> {
  const [command, ...rest] = argv
  const {
    positional: [a, b, ...more],
    named,
  } = options(rest)
  switch (command) {
    case 'put': {
      if (!a || !b) throw new Error(USAGE)
      const value = readValue(b, named.status?.at(0))
      if (a.includes('/reviews/')) notInFuture(value, 'reviewedAt')
      await put(a, value)
      if (isListed(a)) await reindexAfterWrite()
      return print({ ok: true, path: a })
    }
    case 'put-many': {
      if (!a) throw new Error(USAGE)
      const result = await putMany(a)
      if (result.listed) await reindexAfterWrite()
      return print(result)
    }
    case 'get':
      return print(orNull(await get(a)))
    case 'ls':
      return print(await list(a))
    case 'enqueue':
      return print({ id: await enqueue(stage(a), b, named.input ?? []) })
    case 'claim':
      return print(
        orNull(
          await claim(
            stage(a),
            Number(named.lease?.at(0) ?? 30),
            new Date(),
            named.subject?.at(0),
          ),
        ),
      )
    case 'done':
      return print(await done(a, [b, ...more].filter(Boolean)))
    case 'check-facts': {
      const problems = await checkFacts(a)
      print({ ok: problems.length === 0, problems })
      if (problems.length) process.exitCode = 1
      return
    }
    case 'fail':
      return print(await fail(a, [b, ...more].join(' ')))
    case 'publish': {
      const published = await publish(a)
      await reindexAfterWrite()
      return print({ ok: true, report: a, ...published })
    }
    case 'index':
      return print({ ok: true, ...(await reindex()) })
    case 'worklist': {
      const worklist = await readOrgWorklist(a)
      if (!worklist) throw new Error(`기관 없음: ${a}`)
      return print(
        worklist.items.map((i) => ({
          path: `programs/${i.id}`,
          name: i.name,
          stage: i.stage,
          priority: i.priority,
          why: i.priorityWhy,
          budget: i.budget?.amount ?? null,
          materials: i.materials,
          facts: i.facts,
          latestReport: i.latestReport,
        })),
      )
    }
    case 'vendor-worklist':
      return print(await readVendorWorklist(a))
    default:
      throw new Error(USAGE)
  }
}

/** 출력이 파이프로 다 나간 뒤에 끝낸다. 바로 exit하면 큰 출력(리포트 본문)이 잘린다 */
function exit(code: number): void {
  process.stdout.write('', () => process.exit(code))
}

run(process.argv.slice(2)).then(
  () => exit(Number(process.exitCode ?? 0)),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
    exit(1)
  },
)
