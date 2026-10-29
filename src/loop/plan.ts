// 리포트 루프·업체 루프의 순서 정하기. 단계마다 다음 칸, 고침 모델, 멈춤을 결정론적으로 정한다(LLM 오케스트레이터를 대신한다).
import type { WorkStage } from '#/features/worklist/stage'

export type Step =
  'collect' | 'extract' | 'ledger' | 'draft' | 'verify' | 'fix' | 'publish'

/** 단계 → 이번에 차례로 돌릴 칸. 칸을 다 돌면 단계를 다시 읽어 다음을 정한다 */
const CHAINS: Record<WorkStage, ReadonlyArray<Step>> = {
  대기: ['collect', 'extract', 'ledger', 'draft'],
  수집: ['collect', 'extract', 'ledger', 'draft'],
  분석: ['ledger', 'draft'],
  작성: ['draft'],
  검증: ['verify'],
  고침: ['fix'],
  '게시 대기': ['publish'],
  게시: [],
}

export function chainFor(stage: WorkStage): ReadonlyArray<Step> {
  return CHAINS[stage]
}

export interface ReviewEntry {
  /** reviews/{기준일}-{n} */
  id: string
  report: string
  verdict: 'pass' | 'fail'
  reviewedAt: string
  findings: ReadonlyArray<{ where: string; type: string; severity: string }>
}

const highKeys = (r: ReviewEntry): Set<string> =>
  new Set(
    r.findings
      .filter((f) => f.severity === 'high')
      .map((f) => `${f.where}\u0000${f.type}`),
  )

/** 두 검증 기록에 같은 위치·유형의 high가 있나 (고침이 그 지적을 못 푼다) */
export function sameHighs(before: ReviewEntry, after: ReviewEntry): boolean {
  const keys = highKeys(before)
  return [...highKeys(after)].some((k) => keys.has(k))
}

/** 고칠 횟수: 첫 fail은 Sonnet, 두 번째는 Opus, 세 번째 fail이면 사람에게 넘긴다 */
const MAX_FAILS = 3

export type FixDecision =
  | { kind: 'fix'; model: 'sonnet' | 'opus'; review: string }
  | { kind: 'stop'; why: string }

/** 고침 단계에서: 이 판(asOf)의 검증 기록으로 고침 모델을 정하거나 멈춘다 */
export function fixDecision(
  reviews: ReadonlyArray<ReviewEntry>,
  asOf: string,
): FixDecision {
  const fails = reviews
    .filter((r) => r.report === asOf && r.verdict === 'fail')
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
  const last = fails.at(-1)
  if (!last) return { kind: 'stop', why: `${asOf} 판의 fail 검증 기록 없음` }
  if (fails.length >= MAX_FAILS)
    return { kind: 'stop', why: `검증 ${fails.length}회 fail` }
  const prev = fails.at(-2)
  if (prev && sameHighs(prev, last))
    return {
      kind: 'stop',
      why: `같은 high가 두 회차 연달아 남음 (${prev.id}, ${last.id})`,
    }
  return {
    kind: 'fix',
    model: fails.length === 1 ? 'sonnet' : 'opus',
    review: last.id,
  }
}

export interface ProgramItem {
  path: string
  stage: WorkStage
  priority: 'high' | 'medium' | 'low'
  /** 예산현액 (원). 없으면 null */
  budget: number | null
}

const STAGE_ORDER: Record<WorkStage, number> = {
  고침: 0,
  검증: 1,
  작성: 2,
  분석: 2,
  수집: 2,
  대기: 3,
  '게시 대기': 4,
  게시: 5,
}
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

/**
 * 이번 실행에서 돌릴 사업: 고침 → 검증 → 이어 하기 → 대기, 같은 단계면 우선순위·예산 순으로 count개.
 * 게시 대기는 일꾼이 필요 없어 개수와 상관없이 모두. paths를 주면 그 사업만
 */
export function pickPrograms(
  items: ReadonlyArray<ProgramItem>,
  count: number,
  paths?: ReadonlyArray<string>,
): Array<string> {
  if (paths?.length)
    return items.filter((i) => paths.includes(i.path)).map((i) => i.path)
  const work = items
    .filter((i) => STAGE_ORDER[i.stage] <= STAGE_ORDER.대기)
    .sort(
      (a, b) =>
        STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (b.budget ?? 0) - (a.budget ?? 0),
    )
    .slice(0, count)
  const ready = items.filter((i) => i.stage === '게시 대기')
  return [...work, ...ready].map((i) => i.path)
}
