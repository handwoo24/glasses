/**
 * 7개 축 평가(평가 체계 v0.1)의 판정 도구와 리포트 문서가 같이 쓰는 타입.
 * 문장 규칙은 glasses 문서 작성 체계를 따른다.
 */
import {
  AXIS_IDS,
  AXIS_INFO,
  overallEvidence,
  overallRule,
  overallStatus,
} from './axes'
import type {
  AxisId,
  AxisStatus,
  AxisStatuses,
  EvidenceLevel,
  OverallEvidence,
} from './axes'

export type Tone = 'ok' | 'warn' | 'bad' | 'none'

export const STATUS_TONE: Record<AxisStatus, Tone> = {
  'on-track': 'ok',
  watch: 'warn',
  fix: 'bad',
  unknown: 'none',
}

/** 목록 요약에서 나쁜 상태부터 센다 */
const GROUP_ORDER: ReadonlyArray<AxisStatus> = [
  'fix',
  'watch',
  'on-track',
  'unknown',
]

export interface StatusGroup {
  status: AxisStatus
  axes: AxisId[]
}

/** 상태별로 축을 묶는다. 축이 없는 상태는 뺀다 */
export function groupByStatus(
  axes: Record<AxisId, { status: AxisStatus }>,
): StatusGroup[] {
  return GROUP_ORDER.map((status) => ({
    status,
    axes: AXIS_IDS.filter((a) => axes[a].status === status),
  })).filter((g) => g.axes.length > 0)
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

type Judged = {
  axes: Record<AxisId, { status: AxisStatus; evidence: EvidenceLevel }>
}

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

/** ‘④ 비용’ */
function axisName(a: AxisId): string {
  return `${AXIS_INFO[a].no} ${AXIS_INFO[a].label}`
}

/** 받침이 있으면 이, 없으면 가 */
function subjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code < 11172 && code % 28 !== 0 ? '이' : '가'
}

const COUNT_WORD = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱']

const WATCH_RULE =
  '‘개선 필요’가 한 축이거나 ②·③ 가운데 ‘순항’이 아닌 축이 있으면 ‘지켜볼 점 있음’입니다.'

/** 판정 이유: 종합 판정 규칙의 어느 줄에 어떤 축 때문에 걸렸는지 한두 문장으로 */
export function verdictReason(statuses: AxisStatuses): string {
  const fixes = AXIS_IDS.filter((a) => statuses[a] === 'fix')
  const core = (['progress', 'outcome'] as const).filter(
    (a) => statuses[a] !== 'on-track',
  )
  const coreNames =
    core.length === 2
      ? '② 진척과 ③ 성과'
      : core.map((a) => axisName(a)).join('')
  switch (overallRule(statuses)) {
    case 0: {
      const name = axisName(
        statuses.progress === 'fix' ? 'progress' : 'outcome',
      )
      return `핵심 축인 ${name}${subjectParticle(name)} ‘개선 필요’입니다. ② 진척이나 ③ 성과가 ‘개선 필요’이면 종합 판정도 ‘개선 필요’입니다.`
    }
    case 1:
      return `${fixes.map(axisName).join(' · ')} ${COUNT_WORD[fixes.length]} 축이 ‘개선 필요’입니다. ‘개선 필요’가 두 축 이상이면 종합 판정도 ‘개선 필요’입니다.`
    case 2:
      return '② 진척과 ③ 성과를 아직 판단할 수 없고 ‘개선 필요’인 축이 없어 ‘아직 판단 불가’입니다.'
    case 3: {
      const notOnTrack = `${coreNames}${subjectParticle(coreNames)} ‘순항’이 아닙니다.`
      if (fixes.length === 0) return `${notOnTrack} ${WATCH_RULE}`
      const fix = `‘개선 필요’는 ${axisName(fixes[0])} 하나`
      return core.length > 0
        ? `${fix}이고, ${notOnTrack} ${WATCH_RULE}`
        : `${fix}입니다. ${WATCH_RULE}`
    }
    default:
      return '② 진척과 ③ 성과가 ‘순항’이고 ‘개선 필요’인 축이 없어 ‘순항’입니다.'
  }
}

/** 축과 답이 정해진 점검 질문 */
export interface ClassifiedCheck {
  axis: AxisId
  answer: Answer
  question: string
  finding: string
  criterion: string
  cite: ReadonlyArray<string>
}

export function answerCounts(
  checks: ReadonlyArray<Pick<ClassifiedCheck, 'answer'>>,
): Record<Answer, number> {
  return Object.fromEntries(
    ANSWERS.map((a) => [a, checks.filter((k) => k.answer === a).length]),
  ) as Record<Answer, number>
}
