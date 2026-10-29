/**
 * 평가 체계 v0.1 (초안) — 7개 축.
 * 축마다 상태(사업이 어떤가)와 근거 수준(그 판정을 얼마나 믿을 수 있나)을 따로 매기고,
 * 평균을 내지 않고 정해진 순서의 규칙으로 종합 판정 하나를 정한다.
 * 기준값(90%, 70% 등)은 glasses가 정한 초안이며 법령이나 공식 평가 기준이 아니다.
 */

export const AXES_VERSION = '0.1'

export const AXIS_IDS = [
  'goal',
  'progress',
  'outcome',
  'cost',
  'execution',
  'sustainability',
  'accountability',
] as const
export type AxisId = (typeof AXIS_IDS)[number]

export const AXIS_STATUSES = ['on-track', 'watch', 'fix', 'unknown'] as const
export type AxisStatus = (typeof AXIS_STATUSES)[number]

export const EVIDENCE_LEVELS = ['full', 'partial', 'thin'] as const
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number]
export type OverallEvidence = 'high' | 'medium' | 'low'

export type AxisStatuses = Record<AxisId, AxisStatus>
/** 축별 근거 수준. 종합 판정은 핵심 축의 ‘부족’만 본다 */
export type AxisEvidence = Partial<Record<AxisId, EvidenceLevel>>

export const AXIS_INFO: Record<
  AxisId,
  { no: string; label: string; question: string; core?: boolean }
> = {
  goal: {
    no: '①',
    label: '목표',
    question: '왜 하고, 무엇을 이루겠다고 했나?',
  },
  progress: {
    no: '②',
    label: '진척',
    question: '약속한 것을 일정대로 만들고 있나?',
    core: true,
  },
  outcome: {
    no: '③',
    label: '성과',
    question: '시민이 실제로 쓰고, 효과가 있나?',
    core: true,
  },
  cost: { no: '④', label: '비용', question: '돈값을 하나?' },
  execution: { no: '⑤', label: '집행', question: '정해진 규칙대로 쓰였나?' },
  sustainability: {
    no: '⑥',
    label: '지속성',
    question: '사업이 끝난 뒤에도 감당할 수 있나?',
  },
  accountability: {
    no: '⑦',
    label: '투명성·책임',
    question: '시민이 확인할 수 있고, 지적받으면 고치나?',
  },
}

export const STATUS_INFO: Record<
  AxisStatus,
  { label: string; overall: string }
> = {
  'on-track': { label: '순항', overall: '순항' },
  watch: { label: '지켜볼 점', overall: '지켜볼 점 있음' },
  fix: { label: '개선 필요', overall: '개선 필요' },
  unknown: { label: '판단 불가', overall: '아직 판단 불가' },
}

export const EVIDENCE_INFO: Record<
  EvidenceLevel,
  { label: string; dots: string; meaning: string }
> = {
  full: {
    label: '충분',
    dots: '●●●',
    meaning: '원문 문서(계약서, 예산서, 공고문, 보고서)로 직접 확인했다.',
  },
  partial: {
    label: '일부',
    dots: '●●○',
    meaning: '회의 발언이나 간접 자료로 확인했고, 문서는 일부만 봤다.',
  },
  thin: {
    label: '부족',
    dots: '●○○',
    meaning: '핵심 문서를 보지 못했다(청구 전, 비공개).',
  },
}

export const OVERALL_EVIDENCE_INFO: Record<OverallEvidence, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

/** 종합 판정 규칙을 사람이 읽는 문장으로. overallStatus와 같은 순서다 */
export const OVERALL_RULES: ReadonlyArray<string> = [
  '② 진척 또는 ③ 성과가 ‘개선 필요’다 → 개선 필요',
  '‘개선 필요’인 축이 두 개 이상이다 → 개선 필요',
  '②와 ③이 모두 ‘판단 불가’이고 ‘개선 필요’인 축이 없다 → 아직 판단 불가',
  '‘개선 필요’인 축이 하나이거나, ②·③ 중 하나라도 ‘순항’이 아니다 → 지켜볼 점 있음',
  '②와 ③이 ‘순항’이지만 하나라도 근거가 ‘부족’이다 → 지켜볼 점 있음',
  '②와 ③이 ‘순항’이고 근거가 ‘일부’ 이상이며 ‘개선 필요’인 축이 없다 → 순항',
]

/** OVERALL_RULES 각 줄의 결과 */
const OVERALL_RULE_RESULT: ReadonlyArray<AxisStatus> = [
  'fix',
  'fix',
  'unknown',
  'watch',
  'watch',
  'on-track',
]

/** 핵심 축: 근거가 부족하면 다른 축이 모두 좋아도 순항으로 보지 않는다 */
export const CORE_AXES = AXIS_IDS.filter((a) => AXIS_INFO[a].core)

/** 위에서부터 차례로 보고 처음 해당하는 규칙의 번호(0부터, OVERALL_RULES 순서) */
export function overallRule(
  axes: AxisStatuses,
  evidence: AxisEvidence = {},
): number {
  const fixes = AXIS_IDS.filter((a) => axes[a] === 'fix').length
  const { progress, outcome } = axes
  if (progress === 'fix' || outcome === 'fix') return 0
  if (fixes >= 2) return 1
  if (progress === 'unknown' && outcome === 'unknown' && fixes === 0) return 2
  if (fixes === 1 || progress !== 'on-track' || outcome !== 'on-track') return 3
  if (CORE_AXES.some((a) => evidence[a] === 'thin')) return 4
  return 5
}

/** 종합 판정: 위에서부터 차례로 보고 처음 해당하는 규칙으로 정한다 */
export function overallStatus(
  axes: AxisStatuses,
  evidence: AxisEvidence = {},
): AxisStatus {
  return OVERALL_RULE_RESULT[overallRule(axes, evidence)]
}

/** 종합 근거 수준: ‘충분’이 과반이면 높음, ‘부족’이 과반이면 낮음, 그 밖에는 중간 */
export function overallEvidence(
  levels: ReadonlyArray<EvidenceLevel>,
): OverallEvidence {
  const half = levels.length / 2
  if (levels.filter((l) => l === 'full').length > half) return 'high'
  if (levels.filter((l) => l === 'thin').length > half) return 'low'
  return 'medium'
}
