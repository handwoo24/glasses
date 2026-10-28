// 파이프라인 도구. 에이전트는 Firestore에 직접 쓰지 않고 이 도구로 쓴다(양식·참조 검사).
// 사용법은 인자 없이 실행하면 나온다. 예: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npm run pipeline -- ls programs
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { checkFacts } from '#/pipeline/check'
import { PATH_HELP } from '#/pipeline/paths'
import { claim, done, enqueue, fail } from '#/pipeline/queue'
import { STAGES } from '#/pipeline/schemas'
import type { Stage } from '#/pipeline/schemas'
import { get, list, put } from '#/pipeline/store'

const USAGE = `사용법: npm run pipeline -- <명령>
  put <문서 경로> <파일.yaml|.json|.md> [--status draft|in-review|published]
  get <문서 경로>
  ls <컬렉션 경로>
  enqueue <단계> [사업 id] [--input <경로> ...]
  claim <단계> [--lease 분] [--program 사업 id]
  done <작업 id> [산출물 경로 ...]
  fail <작업 id> <사유>
  check-facts <사업 id>   인용이 원문에 있는지, 자료 파일이 바뀌지 않았는지
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
    case 'put':
      if (!a || !b) throw new Error(USAGE)
      await put(a, readValue(b, named.status?.at(0)))
      return print({ ok: true, path: a })
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
            named.program?.at(0),
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
    default:
      throw new Error(USAGE)
  }
}

run(process.argv.slice(2)).then(
  () => process.exit(process.exitCode ?? 0),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
    process.exit(1)
  },
)
