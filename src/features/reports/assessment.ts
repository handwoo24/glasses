/**
 * 리포트 한 건의 7개 축 평가(평가 체계 v0.1). 리포트 데이터(Report)는 원문에서 모은 사실이고,
 * 평가(Assessment)는 그 사실을 축별로 판정하고 시민용 본문으로 옮긴 것이다.
 * 문장 규칙은 glasses 문서 작성 체계를 따른다.
 */
import type { ReactNode } from 'react'
import { AXIS_IDS, overallEvidence, overallStatus } from './axes'
import type {
  AxisId,
  AxisStatus,
  AxisStatuses,
  EvidenceLevel,
  OverallEvidence,
} from './axes'
import type { Report, RiskSignal, Source } from './schema'

export type Tone = 'ok' | 'warn' | 'bad' | 'none'

export const STATUS_TONE: Record<AxisStatus, Tone> = {
  'on-track': 'ok',
  watch: 'warn',
  fix: 'bad',
  unknown: 'none',
}

/** 점검 질문의 답 */
export const ANSWERS = ['yes', 'no', 'open', 'none'] as const
export type Answer = (typeof ANSWERS)[number]

export const ANSWER_INFO: Record<Answer, { label: string; tone: Tone }> = {
  yes: { label: '충족', tone: 'ok' },
  no: { label: '미충족', tone: 'bad' },
  open: { label: '확인 필요', tone: 'warn' },
  none: { label: '자료 없음', tone: 'none' },
}

/** [문장, ...출처 id] */
export type Cited = readonly [text: string, ...cite: Array<string>]

export interface AxisAssessment {
  status: AxisStatus
  evidence: EvidenceLevel
  /** 종합 판정 목록의 한 줄 (한다체) */
  line: string
  /** 축 카드의 결론 제목 (합니다체) */
  title: string
  facts?: ReadonlyArray<Cited>
  /** 그래프나 표 */
  figure?: ReactNode
  /** 시민 단위 (축마다 최대 하나) */
  per?: string
  /** 시의 설명. “직함(시기): 요약.” 발언자마다 하나 */
  said?: ReadonlyArray<Cited>
  note?: ReactNode
  missing?: string
}

export interface OverviewCell {
  label: '무엇' | '얼마' | '누가' | '언제'
  value: string
  text: string
  cite?: ReadonlyArray<string>
}

export interface UnknownItem {
  label: string
  text: string
  /** 의회나 우리가 요청했는데 받지 못한 것 */
  requested?: boolean
  cite?: ReadonlyArray<string>
}

export interface NewCheck {
  axis: AxisId
  answer: Answer
  question: string
  finding: string
  criterion: string
  cite: ReadonlyArray<string>
}

export interface Assessment {
  /** 리포트 데이터의 slug와 같다 */
  reportSlug: string
  project: string
  title: string
  description: string
  asOf: string
  facts: ReadonlyArray<readonly [label: string, value: string]>
  lede: Cited
  typeNote?: string
  axisIndicators: Partial<Record<AxisId, string>>
  overview: {
    cells: ReadonlyArray<OverviewCell>
    chips?: {
      label: string
      cite?: ReadonlyArray<string>
      items: ReadonlyArray<{ label: string; on?: boolean }>
    }
  }
  side: { title: string; body: ReactNode }
  /** 종합 판정 문장: ① 잘되는 것 ② 가장 큰 문제와 금액 ③ 다음 확인 시점, 4문장 안쪽 */
  verdict: string
  nextDates: ReadonlyArray<readonly [when: string, what: string]>
  status: { title: string; body: ReactNode }
  axes: Record<AxisId, AxisAssessment>
  /** 리포트 데이터의 점검 질문 → [축, 답, 다시 쓴 질문] */
  checkMap: Record<string, readonly [AxisId, Answer, string]>
  newChecks?: ReadonlyArray<NewCheck>
  /** 위험 지표 이름 → 축 */
  signalAxis?: Record<string, AxisId>
  vendors?: { title: string; body: ReactNode }
  unknowns: ReadonlyArray<UnknownItem>
  nextReview: string
  /** 정보공개청구 문구 */
  request: string
  moreActions?: ReactNode
  footNote: string
  extraSources?: ReadonlyArray<Source>
}

type Judged = Pick<Assessment, 'axes'>

export interface Summary {
  statuses: AxisStatuses
  overall: AxisStatus
  evidence: OverallEvidence
  fixCount: number
}

export function summarize({ axes }: Judged): Summary {
  const statuses = Object.fromEntries(
    AXIS_IDS.map((a) => [a, axes[a].status]),
  ) as AxisStatuses
  return {
    statuses,
    overall: overallStatus(statuses),
    evidence: overallEvidence(AXIS_IDS.map((a) => axes[a].evidence)),
    fixCount: AXIS_IDS.filter((a) => statuses[a] === 'fix').length,
  }
}

/** 종합 판정 규칙의 어느 줄에 걸렸는지 한 구절로 */
export function overallReason(overall: AxisStatus, fixCount: number): string {
  switch (overall) {
    case 'fix':
      return `‘개선 필요’인 축이 ${fixCount}개여서`
    case 'watch':
      return fixCount
        ? `‘개선 필요’인 축이 ${fixCount}개이고 핵심 축이 모두 ‘순항’은 아니어서`
        : '‘개선 필요’인 축은 없지만 핵심 축(②·③)이 모두 ‘순항’은 아니어서'
    case 'unknown':
      return '핵심 축(②·③)을 아직 판단할 수 없어'
    case 'on-track':
      return '핵심 축이 순항이고 ‘개선 필요’인 축이 없어'
  }
}

export interface ClassifiedCheck {
  axis: AxisId
  answer: Answer
  question: string
  finding: string
  criterion: string
  cite: ReadonlyArray<string>
}

type ReportChecks = {
  checks: ReadonlyArray<
    Pick<Report['checks'][number], 'question' | 'finding' | 'criterion'> & {
      cite: ReadonlyArray<string>
    }
  >
}

/** 리포트 점검을 축과 답으로 다시 매기고 평가에서 새로 넣은 점검을 붙인다 */
export function classifyChecks(
  report: ReportChecks,
  { checkMap, newChecks = [] }: Pick<Assessment, 'checkMap' | 'newChecks'>,
): Array<ClassifiedCheck> {
  const mapped = report.checks.map((k) => {
    if (!Object.hasOwn(checkMap, k.question))
      throw new Error(`축이 정해지지 않은 점검: ${k.question}`)
    const [axis, answer, question] = checkMap[k.question]
    return {
      axis,
      answer,
      question,
      finding: k.finding,
      criterion: k.criterion,
      cite: k.cite,
    }
  })
  return [...mapped, ...newChecks]
}

/** 재분류 표에 남았지만 리포트 점검에는 없는 질문 (리포트 문구가 바뀌면 생긴다) */
export function staleCheckKeys(
  report: { checks: ReadonlyArray<{ question: string }> },
  { checkMap }: Pick<Assessment, 'checkMap'>,
): Array<string> {
  const asked = new Set(report.checks.map((k) => k.question))
  return Object.keys(checkMap).filter((q) => !asked.has(q))
}

export function answerCounts(
  checks: ReadonlyArray<Pick<ClassifiedCheck, 'answer'>>,
): Record<Answer, number> {
  return Object.fromEntries(
    ANSWERS.map((a) => [a, checks.filter((k) => k.answer === a).length]),
  ) as Record<Answer, number>
}

type Signal = Pick<RiskSignal, 'signal' | 'status' | 'severity' | 'detail'> & {
  cite: ReadonlyArray<string>
}

/** 위험 지표를 축별로 묶는다. 축이 정해지지 않은 지표가 있으면 실패 */
export function signalsByAxis<TSignal extends Signal>(
  { riskSignals = [] }: { riskSignals?: ReadonlyArray<TSignal> },
  { signalAxis = {} }: Pick<Assessment, 'signalAxis'>,
): Record<AxisId, Array<TSignal>> {
  for (const s of riskSignals) {
    if (!Object.hasOwn(signalAxis, s.signal))
      throw new Error(`축이 정해지지 않은 지표: ${s.signal}`)
    if (!(AXIS_IDS as ReadonlyArray<string>).includes(signalAxis[s.signal]))
      throw new Error(`없는 축: ${signalAxis[s.signal]}`)
  }
  return Object.fromEntries(
    AXIS_IDS.map((a) => [
      a,
      riskSignals.filter((s) => signalAxis[s.signal] === a),
    ]),
  ) as Record<AxisId, Array<TSignal>>
}

/** 리포트 출처 뒤에 평가에서 더한 출처를 붙인다. 번호는 이 순서다 */
export function allSources(
  report: Pick<Report, 'sources'>,
  { extraSources = [] }: Pick<Assessment, 'extraSources'>,
): Array<Source> {
  return [...report.sources, ...extraSources]
}
