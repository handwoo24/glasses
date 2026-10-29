// 파이프라인 도구. 에이전트는 Firestore에 직접 쓰지 않고 이 도구로 쓴다(양식·참조 검사).
// 사용법은 인자 없이 실행하면 나온다. 예: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npm run pipeline -- ls programs
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { checkFacts } from '#/pipeline/check'
import { PATH_HELP } from '#/pipeline/paths'
import { publish } from '#/pipeline/publish'
import { claim, done, enqueue, fail } from '#/pipeline/queue'
import { STAGES } from '#/pipeline/schemas'
import type { Stage } from '#/pipeline/schemas'
import { get, list, put } from '#/pipeline/store'
import { readOrgWorklist } from '#/features/worklist/server/worklist.server'
import { readVendorWorklist } from '#/pipeline/vendor-worklist'

const USAGE = `사용법: npm run pipeline -- <명령>
  put <문서 경로> <파일.yaml|.json|.md> [--status draft|in-review|published]
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
      return print({ ok: true, path: a })
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
    case 'publish':
      return print({ ok: true, report: a, ...(await publish(a)) })
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
