// 리포트 루프·업체 루프의 러너. 단계표대로 일꾼(.claude/agents/*)을 `claude -p --agent`로 하나씩 띄우고,
// 일꾼이 돌려준 JSON과 Firestore 단계만 보고 다음 칸을 정한다. 순서 규칙은 src/loop/plan.ts.
// scripts/loop.sh가 운영 환경값을 싣고 부른다. 사용법: loop.sh {기관코드} [개수] [--programs 경로,경로]
//                                                 loop.sh --vendors [기관코드] [개수] [--vendors 경로,경로]
import { spawn } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { HANDBACKS, jsonSchemaOf } from '#/loop/handback'
import type { CollectHandback, HandbackOf, WorkerStep } from '#/loop/handback'
import type { z } from 'zod'
import { chainFor, fixDecision, pickPrograms } from '#/loop/plan'
import type { ProgramItem, ReviewEntry, Step } from '#/loop/plan'
import type { WorkStage } from '#/features/worklist/stage'

/** 동시에 도는 일꾼 수 (모든 대상 합). 구독 세션 한도 안에서 */
const MAX_WORKERS = 16
/** 대상 하나 안에서 동시에 도는 발췌 일꾼 수 */
const MAX_EXTRACTS = 8
/** 대상 하나에서 단계를 다시 읽는 최대 횟수 (고침·검증 왕복 3회를 넉넉히 덮는다) */
const MAX_ROUNDS = 10
/** 나라장터 개발 계정 하루 1,000건. 이보다 많이 썼으면 새 수집을 부르지 않는다 */
const G2B_BUDGET = 800
/** 업체 수집 한 번에 잡아 두는 나라장터 호출 어림값 (끝나면 실제 값으로 맞춘다) */
const G2B_RESERVE = 60

type Collected = z.infer<typeof CollectHandback>

interface Args {
  vendors: boolean
  org?: string
  count: number
  paths: Array<string>
  run: string
  /** 대상과 단계만 보이고 일꾼은 부르지 않는다 */
  dry: boolean
}

interface CostRow {
  subject: string
  step: string
  agent: string
  usd: number
  turns: number
  ms: number
}

class StopSubject extends Error {}
class AbortAll extends Error {}

// ── 인자 ──────────────────────────────────────────────

function countOf(raw: string | undefined): number {
  const n = Number(raw ?? 3)
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`개수는 1 이상의 정수: ${raw}`)
  return n
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  const positional: Array<string> = []
  let vendors = false
  let run: string | undefined
  let paths: Array<string> = []
  let dry = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--vendors' && (argv.at(i + 1) ?? '').startsWith('programs/')) {
      vendors = true
      paths = argv[++i].split(',')
    } else if (a === '--vendors') vendors = true
    else if (a === '--programs') paths = (argv.at(++i) ?? '').split(',')
    else if (a === '--run') run = argv.at(++i)
    else if (a === '--dry') dry = true
    else positional.push(a)
  }
  if (!run)
    throw new Error('--run {run id}가 필요하다 (scripts/loop.sh로 띄운다)')
  const org = positional.at(0)
  const count = positional.at(1)
  if (!vendors && !org) throw new Error('기관코드가 필요하다')
  return {
    vendors,
    org,
    count: countOf(count),
    paths: paths.filter(Boolean),
    dry,
    run,
  }
}

// ── 프로세스 ──────────────────────────────────────────

/** 돌고 있는 자식 프로세스. 러너가 끊기면 같이 끝낸다 */
const children = new Set<ReturnType<typeof spawn>>()
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    for (const c of children) c.kill('SIGTERM')
    process.exit(130)
  })

/** 일꾼 하나가 이보다 오래 돌면 끊는다 (지난 실행에서 가장 긴 칸이 30분 안팎) */
const WORKER_TIMEOUT_MS = 90 * 60 * 1000

function exec(
  cmd: string,
  args: ReadonlyArray<string>,
  timeoutMs = WORKER_TIMEOUT_MS,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    children.add(child)
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      children.delete(child)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

/** 동시에 n개까지. 끝난 자리는 기다린 순서대로 넘긴다 */
function limiter(n: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((r) => waiting.push(r))
    else active++
    try {
      return await fn()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}

async function pipeline<T = unknown>(...args: Array<string>): Promise<T> {
  const r = await exec('node_modules/.bin/tsx', [
    'scripts/pipeline.ts',
    ...args,
  ])
  if (r.code !== 0) throw new Error(`pipeline ${args[0]}: ${r.stderr.trim()}`)
  return JSON.parse(r.stdout) as T
}

// ── 실행 상태 ─────────────────────────────────────────

class Run {
  readonly dir: string
  readonly costs: Array<CostRow> = []
  readonly stumbles: Array<string> = []
  readonly outcomes = new Map<
    string,
    {
      start: WorkStage
      end?: WorkStage
      reviews: Array<string>
      memo: Array<string>
    }
  >()
  readonly slot = limiter(MAX_WORKERS)
  aborted: string | null = null
  /** 오늘 나라장터 호출 수 (실행이 여러 번이어도 하루치를 이어 센다) */
  g2b: number
  private readonly g2bFile: string
  private seq = 0

  constructor(readonly args: Args) {
    this.dir = `.loop/runs/${args.run}`
    mkdirSync(`${this.dir}/workers`, { recursive: true })
    this.g2bFile = `.loop/g2b-${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.json`
    this.g2b = existsSync(this.g2bFile)
      ? (JSON.parse(readFileSync(this.g2bFile, 'utf8')) as { calls: number })
          .calls
      : 0
  }

  /** 나라장터 호출 수를 더하고 하루치 파일에 남긴다. 수집 전에 어림값을 먼저 잡아 동시 수집이 한도를 넘지 않게 한다 */
  addG2b(calls: number): void {
    this.g2b += calls
    writeFileSync(this.g2bFile, JSON.stringify({ calls: this.g2b }))
  }

  log(subject: string, text: string): void {
    const at = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    })
    const line = `- ${at} ${short(subject)} ${text}`
    appendFileSync(`${this.dir}/log.md`, `${line}\n`)
    process.stderr.write(`${line}\n`)
  }

  next(): number {
    return ++this.seq
  }
}

function groupBy<T>(
  items: ReadonlyArray<T>,
  key: (item: T) => string,
): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>()
  for (const item of items)
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}

const short = (path: string) => path.replace(/^programs\//, '')

/** 대상의 작업 폴더: 사업은 {run}/{사업}/, 업체는 {run}/{사업}/{번호}/ */
function workDir(run: Run, subject: string): string {
  const dir = `${run.dir}/${short(subject).replace('/vendors/', '/')}`
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── 일꾼 ──────────────────────────────────────────────

const AGENTS: Record<'program' | 'vendor', Record<WorkerStep, string>> = {
  program: {
    collect: 'report-collector',
    extract: 'report-extractor',
    ledger: 'report-ledger',
    draft: 'report-writer',
    fix: 'report-writer',
    verify: 'report-verifier',
    list: 'vendor-lister',
  },
  vendor: {
    collect: 'vendor-collector',
    extract: 'report-extractor',
    ledger: 'report-ledger',
    draft: 'vendor-writer',
    fix: 'vendor-writer',
    verify: 'report-verifier',
    list: 'vendor-lister',
  },
}

/** 실패한 결과(is_error)의 글에서만 본다. 일꾼이 정상으로 끝낸 글에 같은 낱말이 있어도 멈추지 않는다 */
const LIMIT_PATTERN = /hit your limit|usage limit|rate limit|limit reached/i
const AUTH_PATTERN =
  /UNAUTHENTICATED|PERMISSION_DENIED|invalid_grant|Could not load the default credentials|not logged in|Invalid API key/i

/** 일꾼 하나를 띄우고 JSON 결과를 받는다. 남긴 것 없이 끝나면 한 번만 다시 부른다 */
async function worker<TStep extends WorkerStep>(
  run: Run,
  subject: string,
  step: TStep,
  prompt: string,
  model?: 'opus',
): Promise<HandbackOf<TStep>> {
  const agent =
    AGENTS[subject.includes('/vendors/') ? 'vendor' : 'program'][step]
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (run.aborted) throw new AbortAll(run.aborted)
    const n = run.next()
    const res = await run.slot(() =>
      exec('claude', [
        '-p',
        `${prompt}\n끝낼 때 결과는 주어진 JSON 스키마대로 돌려준다.`,
        '--agent',
        agent,
        ...(model ? ['--model', model] : []),
        '--setting-sources',
        'project',
        '--strict-mcp-config',
        '--settings',
        '.claude/loop.settings.json',
        '--permission-mode',
        'auto',
        '--output-format',
        'json',
        '--json-schema',
        jsonSchemaOf(step),
      ]),
    )
    writeFileSync(
      `${run.dir}/workers/${String(n).padStart(3, '0')}-${short(subject).replaceAll('/', '_')}-${step}.json`,
      res.stdout || res.stderr,
    )
    const out = parseResult(res.stdout)
    // 결과 JSON이 없으면 일꾼이 아니라 claude 실행(인자·설정·로그인)이 잘못된 것이라 모든 대상에 걸린다
    if (!out) {
      run.aborted = `claude 실행 오류: ${(res.stdout || res.stderr).trim().slice(0, 200)}`
      throw new AbortAll(run.aborted)
    }
    run.costs.push({
      subject,
      step,
      agent: model ? `${agent}(opus)` : agent,
      usd: out.total_cost_usd,
      turns: out.num_turns,
      ms: out.duration_ms,
    })
    if (out.is_error) {
      const failure = `${out.result ?? ''} ${res.stderr}`.trim().slice(0, 200)
      if (LIMIT_PATTERN.test(failure) || AUTH_PATTERN.test(failure)) {
        run.aborted = `${LIMIT_PATTERN.test(failure) ? '사용량 한도' : '운영 접속 오류'}: ${failure}`
        throw new AbortAll(run.aborted)
      }
    }
    const parsed = HANDBACKS[step].safeParse(out.structured_output)
    if (!out.is_error && parsed.success) {
      const h = parsed.data as { summary: string; stumbles?: Array<string> }
      run.log(subject, `${step} 끝: ${h.summary}`)
      for (const s of h.stumbles ?? [])
        run.stumbles.push(`- ${short(subject)} / ${step}: ${s}`)
      return parsed.data as HandbackOf<TStep>
    }
    run.log(
      subject,
      `${step} ${attempt}회째 남긴 것 없이 끝남 (${out.subtype})`,
    )
  }
  throw new StopSubject(`${step} 일꾼이 두 번 남긴 것 없이 끝남`)
}

interface ClaudeResult {
  is_error: boolean
  subtype: string
  result?: string
  structured_output?: unknown
  total_cost_usd: number
  num_turns: number
  duration_ms: number
}

function parseResult(stdout: string): ClaudeResult | null {
  try {
    return JSON.parse(stdout) as ClaudeResult
  } catch {
    return null
  }
}

// ── 단계와 기록 읽기 ──────────────────────────────────

const orgOf = (subject: string) => short(subject).split('.')[0]

async function stageOf(subject: string): Promise<WorkStage> {
  if (subject.includes('/vendors/')) {
    const wl = await pipeline<{
      vendors: Array<{ path: string; stage: WorkStage }>
    }>('vendor-worklist', orgOf(subject))
    const v = wl.vendors.find((i) => i.path === subject)
    if (!v) throw new StopSubject('업체 조사 목록에 없음')
    return v.stage
  }
  const items = await pipeline<Array<{ path: string; stage: WorkStage }>>(
    'worklist',
    orgOf(subject),
  )
  const p = items.find((i) => i.path === subject)
  if (!p) throw new StopSubject('worklist에 없음')
  return p.stage
}

async function latestReport(subject: string): Promise<string> {
  const reports = await pipeline<Array<{ id: string }>>(
    'ls',
    `${subject}/reports`,
  )
  const asOf = reports
    .map((r) => r.id)
    .sort()
    .at(-1)
  if (!asOf) throw new StopSubject('리포트가 없음')
  return asOf
}

async function reviewsOf(subject: string): Promise<Array<ReviewEntry>> {
  const rows = await pipeline<
    Array<{ id: string; data: Omit<ReviewEntry, 'id'> }>
  >('ls', `${subject}/reviews`)
  return rows.map((r) => ({ id: r.id, ...r.data }))
}

// ── 칸 ────────────────────────────────────────────────

/** 발췌 일꾼에게 넘길 대상 정보: 사업은 이름·세부사업 코드·부서, 업체는 이름·계약명·계약번호 */
async function extractInfo(subject: string): Promise<string> {
  const card = await pipeline<Record<string, unknown> | null>('get', subject)
  if (!card) throw new StopSubject('카드 없음')
  if (subject.includes('/vendors/')) {
    const contracts = (
      card.contracts as Array<{ name: string; no: string }>
    ).map((c) => `${c.name}(${c.no})`)
    return `업체 이름: ${String(card.name)}\n계약명·계약번호: ${contracts.join(', ')}`
  }
  const lines = (card.budgetLines as Array<string> | undefined) ?? []
  const depts = (card.departments as Array<string> | undefined) ?? []
  return `사업 이름: ${String(card.name)}\n세부사업 코드: ${lines.join(', ') || '없음'}\n부서: ${depts.join(', ') || '없음'}`
}

async function extractAll(
  run: Run,
  subject: string,
  dir: string,
  collected: Collected | undefined,
): Promise<void> {
  if (!collected) {
    run.log(subject, 'extract 건너뜀: 이번 실행에 수집 결과가 없음')
    return
  }
  mkdirSync(`${dir}/extracts`, { recursive: true })
  const info = await extractInfo(subject)
  const local = limiter(MAX_EXTRACTS)
  const label = subject.includes('/vendors/') ? '업체 경로' : '사업 경로'
  await Promise.all(
    collected.materials.map((m) =>
      local(async () => {
        const out = `${dir}/extracts/${m.id}.json`
        if (!m.text)
          return run.log(subject, `extract 안 함: ${m.id} 글자 파일 없음`)
        if (existsSync(out)) return
        try {
          await worker(
            run,
            subject,
            'extract',
            `${label}: ${subject}\n${info}\n자료 id: ${m.id}\n글자 파일: ${m.text}\n출력 파일: ${out}`,
          )
        } catch (e) {
          if (e instanceof AbortAll) throw e
          run.log(subject, `extract 실패: ${m.id} (${(e as Error).message})`)
        }
      }),
    ),
  )
}

/** 사실 원장이 읽을 발췌 폴더: 이번 실행에 없으면(분석 단계로 이어 할 때) 가장 최근 실행의 것 */
function extractsDir(run: Run, subject: string, dir: string): string {
  const here = `${dir}/extracts/`
  if (existsSync(here)) return here
  const rel = short(subject).replace('/vendors/', '/')
  const previous = readdirSync('.loop/runs')
    .sort()
    .reverse()
    .map((r) => `.loop/runs/${r}/${rel}/extracts/`)
    .find((d) => existsSync(d))
  if (previous) run.log(subject, `발췌 폴더를 지난 실행에서 씀: ${previous}`)
  return previous ?? `${here} (없음: 발췌 없이 자료 원문에서 찾는다)`
}

/** 같은 업체(번호)가 여러 사업에 나올 때, 먼저 받은 업체 단위 자료 id를 다음 수집 칸에 넘긴다 */
const vendorMaterials = new Map<string, Array<string>>()
const biznoOf = (subject: string) => subject.split('/vendors/')[1]

async function runStep(
  run: Run,
  subject: string,
  step: Step,
  state: { collected?: Collected },
): Promise<void> {
  const dir = workDir(run, subject)
  const base = `${subject.includes('/vendors/') ? '업체 경로' : '사업 경로'}: ${subject}\nrun 폴더: ${dir}/`
  switch (step) {
    case 'collect': {
      if (run.g2b > G2B_BUDGET)
        throw new StopSubject(
          `나라장터 호출 ${run.g2b}건으로 새 수집을 부르지 않음`,
        )
      const shared = subject.includes('/vendors/')
        ? vendorMaterials.get(biznoOf(subject))
        : undefined
      const extra = shared?.length
        ? `\n같은 업체의 업체 단위 자료(제재·기본정보·시 계약 전체)는 이미 받았다: ${shared.join(', ')}. 다시 받지 말고 subjects에 이 업체 경로를 더해 쓴다.`
        : ''
      const reserve = subject.includes('/vendors/') ? G2B_RESERVE : 0
      run.addG2b(reserve)
      const c = await worker(run, subject, 'collect', base + extra)
      run.addG2b(c.g2bCalls - reserve)
      if (subject.includes('/vendors/'))
        vendorMaterials.set(biznoOf(subject), [
          ...(shared ?? []),
          ...c.materials.map((m) => m.id),
        ])
      for (const w of c.wrongUploads)
        run.outcomes.get(subject)?.memo.push(`잘못 올린 자료: ${w}`)
      state.collected = c
      return
    }
    case 'extract':
      return extractAll(run, subject, dir, state.collected)
    case 'ledger': {
      const missing =
        state.collected?.notFound.join('; ') || '이번 실행에 수집 칸 결과 없음'
      await worker(
        run,
        subject,
        'ledger',
        `${base}\n발췌 폴더: ${extractsDir(run, subject, dir)}\n수집 칸의 못 찾은 것: ${missing}`,
      )
      return
    }
    case 'draft':
      await worker(run, subject, 'draft', `${base}\n할 일: 초안`)
      return
    case 'verify': {
      const v = await worker(run, subject, 'verify', base)
      run.outcomes
        .get(subject)
        ?.reviews.push(`${v.verdict}(high ${v.counts.high})`)
      return
    }
    case 'fix': {
      const asOf = await latestReport(subject)
      const d = fixDecision(await reviewsOf(subject), asOf)
      if (d.kind === 'stop') throw new StopSubject(d.why)
      await worker(
        run,
        subject,
        'fix',
        `${base}\n할 일: 고침\n검증 기록: ${subject}/reviews/${d.review}`,
        d.model === 'opus' ? 'opus' : undefined,
      )
      return
    }
    case 'publish': {
      const report = `${subject}/reports/${await latestReport(subject)}`
      try {
        const r = await pipeline<Record<string, unknown>>('publish', report)
        run.log(subject, `게시 ok: ${JSON.stringify(r)}`)
      } catch (e) {
        throw new StopSubject(`게시 거부: ${(e as Error).message}`)
      }
    }
  }
}

/** 대상 하나: 단계를 읽고 → 그 단계의 칸을 차례로 → 다시 단계를 읽는다. 단계가 그대로면 멈춘다 */
async function runSubject(run: Run, subject: string): Promise<void> {
  const state: { collected?: Collected } = {}
  let stage: WorkStage
  try {
    stage = await stageOf(subject)
  } catch (e) {
    run.log(subject, `시작 못 함: ${(e as Error).message}`)
    return
  }
  const outcome = {
    start: stage,
    reviews: [] as Array<string>,
    memo: [] as Array<string>,
    end: stage,
  }
  run.outcomes.set(subject, outcome)
  try {
    for (let round = 0; round < MAX_ROUNDS && stage !== '게시'; round++) {
      run.log(subject, `단계 ${stage} → ${chainFor(stage).join(' → ')}`)
      for (const step of chainFor(stage))
        await runStep(run, subject, step, state)
      const after = await stageOf(subject)
      outcome.end = after
      if (after === stage)
        throw new StopSubject(`칸을 돌았는데 단계가 ${stage} 그대로`)
      stage = after
    }
    if (stage !== '게시' && stage !== '게시 대기')
      outcome.memo.push(`단계 읽기 ${MAX_ROUNDS}회를 다 써서 멈춤`)
  } catch (e) {
    const why = (e as Error).message
    outcome.memo.push(
      e instanceof AbortAll ? `전체 멈춤: ${why}` : `멈춤: ${why}`,
    )
    run.log(subject, `멈춤: ${why}`)
    if (!(e instanceof StopSubject) && !(e instanceof AbortAll))
      outcome.memo.push('(러너 오류)')
    outcome.end = await stageOf(subject).catch(() => outcome.end)
  }
}

// ── 대상 고르기 ───────────────────────────────────────

async function programTargets(run: Run): Promise<Array<string>> {
  const items = await pipeline<
    Array<{
      path: string
      stage: WorkStage
      priority: ProgramItem['priority']
      budget: number | null
    }>
  >('worklist', run.args.org ?? '')
  return pickPrograms(items, run.args.count, run.args.paths)
}

async function vendorTargets(run: Run): Promise<Array<string>> {
  const org = run.args.org ? [run.args.org] : []
  const first = await pipeline<{ toList: Array<string> }>(
    'vendor-worklist',
    ...org,
  )
  if (run.args.dry && first.toList.length)
    run.log(
      'run',
      `목록화할 사업(dry라 건너뜀): ${first.toList.map(short).join(', ')}`,
    )
  await Promise.all(
    first.toList.map(async (p) => {
      if (run.args.dry) return
      try {
        await worker(
          run,
          p,
          'list',
          `사업 경로: ${p}\nrun 폴더: ${workDir(run, p)}/`,
        )
      } catch (e) {
        if (e instanceof AbortAll) throw e
        run.log(p, `목록화 실패: ${(e as Error).message}`)
      }
    }),
  )
  const wl = await pipeline<{
    vendors: Array<{
      path: string
      stage: WorkStage
      priority: ProgramItem['priority']
      amount: number
    }>
  }>('vendor-worklist', ...org)
  return pickPrograms(
    wl.vendors.map((v) => ({
      path: v.path,
      stage: v.stage,
      priority: v.priority,
      budget: v.amount,
    })),
    run.args.count,
    run.args.paths,
  )
}

/** 같은 번호 업체는 차례로(업체 단위 자료를 넘겨받도록), 번호끼리는 동시에 */
async function runVendors(
  run: Run,
  targets: ReadonlyArray<string>,
): Promise<void> {
  const groups = groupBy(targets, biznoOf)
  await Promise.all(
    [...groups.values()].map(async (group) => {
      for (const v of group) await runSubject(run, v)
    }),
  )
}

// ── 끝낼 때 ───────────────────────────────────────────

function summarize(run: Run, targets: ReadonlyArray<string>): string {
  const rows = targets.map((t) => {
    const o = run.outcomes.get(t)
    return `| ${short(t)} | ${o?.start ?? '?'} → ${o?.end ?? '?'} | ${o?.reviews.join(' → ') || '—'} | ${o?.memo.join('; ') || ''} |`
  })
  const bySteps = groupBy(run.costs, (c) => c.agent)
  const costRows = [...bySteps.entries()]
    .map(([agent, cs]) => ({
      agent,
      n: cs.length,
      usd: cs.reduce((s, c) => s + c.usd, 0),
      turns: cs.reduce((s, c) => s + c.turns, 0),
    }))
    .sort((a, b) => b.usd - a.usd)
    .map((c) => `| ${c.agent} | ${c.n} | ${c.turns} | $${c.usd.toFixed(2)} |`)
  const total = run.costs.reduce((s, c) => s + c.usd, 0)
  const published = targets.filter(
    (t) => run.outcomes.get(t)?.end === '게시',
  ).length
  return [
    '## 요약',
    '',
    '| 대상 | 시작 단계 → 끝 단계 | 검증 회차 (high 수) | 메모 |',
    '|---|---|---|---|',
    ...rows,
    '',
    '| 일꾼 | 호출 | 턴 | 비용(API 환산) |',
    '|---|---|---|---|',
    ...costRows,
    '',
    `총 $${total.toFixed(2)}, 게시 ${published}건${run.args.vendors ? `, 나라장터 호출 ${run.g2b}건` : ''}`,
    run.aborted ? `전체 멈춤: ${run.aborted}` : '',
    '사람이 볼 것: stumbles.md, 멈춘 대상',
  ].join('\n')
}

async function main(): Promise<void> {
  const run = new Run(parseArgs(process.argv.slice(2)))
  if (!process.env.GLASSES_FIRESTORE_PROJECT)
    throw new Error(
      'GLASSES_FIRESTORE_PROJECT가 비었다. scripts/loop.sh로 띄운다',
    )
  if (run.args.vendors && !process.env.DATA_GO_KR_SERVICE_KEY)
    throw new Error('DATA_GO_KR_SERVICE_KEY가 비었다')
  let targets: Array<string> = []
  // 전체 멈춤(사용량 한도·접속 오류)이나 러너 오류로 끝나도 비용·걸려 넘어진 것·요약은 남긴다
  try {
    targets = run.args.vendors
      ? await vendorTargets(run)
      : await programTargets(run)
    run.log('run', `대상 ${targets.length}개: ${targets.map(short).join(', ')}`)
    if (run.args.dry) {
      for (const t of targets) {
        const stage = await stageOf(t)
        run.log(t, `단계 ${stage} → ${chainFor(stage).join(' → ') || '끝'}`)
      }
      return
    }
    if (run.args.vendors) await runVendors(run, targets)
    else await Promise.all(targets.map((t) => runSubject(run, t)))
  } catch (e) {
    run.log('run', `멈춤: ${(e as Error).message}`)
    process.exitCode = 1
  } finally {
    if (!run.args.dry) {
      writeFileSync(
        `${run.dir}/stumbles.md`,
        `# 걸려 넘어진 것 — run ${run.args.run}\n\n${run.stumbles.join('\n')}\n`,
      )
      writeFileSync(`${run.dir}/costs.json`, JSON.stringify(run.costs, null, 2))
      const summary = summarize(run, targets)
      appendFileSync(`${run.dir}/log.md`, `\n${summary}\n`)
      process.stdout.write(`${summary}\n`)
    }
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
