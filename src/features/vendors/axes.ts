/**
 * 업체 리포트 평가 체계 v0.1 (초안) — 6개 축.
 * 사업 리포트의 7개 축과 같은 방식(축마다 상태와 근거 수준, 평균 없이 규칙으로 종합)이지만
 * 축은 계약의 일생(선정 → 약속 → 이행 → 결과물 → 금액, 그리고 이력)을 따른다.
 * 축마다 책임 주체를 둔다: 발주기관이 정한 것으로 업체를 깎지 않는다.
 */
import type { AxisSet, AxisStatus, EvidenceLevel } from '../reports/axes'

export const VENDOR_AXIS_IDS = [
  'selection',
  'scope',
  'delivery',
  'output',
  'cost',
  'record',
] as const
export type VendorAxisId = (typeof VENDOR_AXIS_IDS)[number]
export type VendorAxisStatuses = Record<VendorAxisId, AxisStatus>
export type VendorAxisEvidence = Partial<Record<VendorAxisId, EvidenceLevel>>

/** 누구의 몫인가: 발주기관(조달청·시)이 정하는 것, 업체가 책임지는 것, 함께 정하는 것 */
export const OWNERS = ['agency', 'shared', 'vendor'] as const
export type Owner = (typeof OWNERS)[number]
export const OWNER_LABEL: Record<Owner, string> = {
  agency: '발주기관',
  shared: '함께',
  vendor: '업체',
}

export const VENDOR_AXIS_INFO: Record<
  VendorAxisId,
  {
    no: string
    label: string
    question: string
    owner: Owner
    core?: boolean
  }
> = {
  selection: {
    no: '①',
    label: '선정',
    question: '이 업체가 어떻게 맡게 됐나?',
    owner: 'agency',
  },
  scope: {
    no: '②',
    label: '약속',
    question: '무엇을, 언제까지, 얼마에 하기로 했나?',
    owner: 'shared',
  },
  delivery: {
    no: '③',
    label: '이행',
    question: '약속한 일정대로 했나?',
    owner: 'vendor',
    core: true,
  },
  output: {
    no: '④',
    label: '결과물',
    question: '약속한 것을 냈고, 검수를 통과했나?',
    owner: 'vendor',
    core: true,
  },
  cost: {
    no: '⑤',
    label: '금액',
    question: '계약 금액이 어떻게 변했나?',
    owner: 'shared',
  },
  record: {
    no: '⑥',
    label: '이력',
    question: '공식 기록에 남은 처분이나 같은 종류 계약의 결과는?',
    owner: 'vendor',
  },
}

export const VENDOR_AXES: AxisSet<VendorAxisId> = {
  ids: VENDOR_AXIS_IDS,
  name: (a) => `${VENDOR_AXIS_INFO[a].no} ${VENDOR_AXIS_INFO[a].label}`,
}

const CORE = VENDOR_AXIS_IDS.filter((a) => VENDOR_AXIS_INFO[a].core)

/** 업체 종합 판정 규칙을 사람이 읽는 문장으로. vendorOverallRule과 같은 순서다 */
export const VENDOR_OVERALL_RULES: ReadonlyArray<string> = [
  '③ 이행 또는 ④ 결과물이 ‘개선 필요’다 → 개선 필요',
  '⑥ 이력이 ‘개선 필요’다(이 계약과 같은 종류의 확정 처분) → 개선 필요',
  '② 약속과 ⑤ 금액이 모두 ‘개선 필요’다 → 개선 필요',
  '③과 ④가 모두 ‘판단 불가’이고 ‘개선 필요’인 축이 없다 → 아직 판단 불가',
  '‘개선 필요’인 축이 있거나(① 포함), ③·④ 중 하나라도 ‘순항’이 아니다 → 지켜볼 점 있음',
  '③과 ④가 ‘순항’이지만 하나라도 근거가 ‘부족’이다 → 지켜볼 점 있음',
  '③과 ④가 ‘순항’이고 근거가 ‘일부’ 이상이며 ‘개선 필요’인 축이 없다 → 순항',
]

const RULE_RESULT: ReadonlyArray<AxisStatus> = [
  'fix',
  'fix',
  'fix',
  'unknown',
  'watch',
  'watch',
  'on-track',
]

/** 위에서부터 차례로 보고 처음 해당하는 규칙의 번호(0부터, VENDOR_OVERALL_RULES 순서) */
export function vendorOverallRule(
  axes: VendorAxisStatuses,
  evidence: VendorAxisEvidence = {},
): number {
  const { delivery, output, record, scope, cost } = axes
  const anyFix = VENDOR_AXIS_IDS.some((a) => axes[a] === 'fix')
  if (delivery === 'fix' || output === 'fix') return 0
  if (record === 'fix') return 1
  if (scope === 'fix' && cost === 'fix') return 2
  if (delivery === 'unknown' && output === 'unknown' && !anyFix) return 3
  if (anyFix || delivery !== 'on-track' || output !== 'on-track') return 4
  if (CORE.some((a) => evidence[a] === 'thin')) return 5
  return 6
}

export function vendorOverallStatus(
  axes: VendorAxisStatuses,
  evidence: VendorAxisEvidence = {},
): AxisStatus {
  return RULE_RESULT[vendorOverallRule(axes, evidence)]
}

function axisName(a: VendorAxisId): string {
  return VENDOR_AXES.name(a)
}

/** 받침이 있으면 이, 없으면 가 */
function subject(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return word + (code >= 0 && code < 11172 && code % 28 !== 0 ? '이' : '가')
}

const CORE_PAIR = '③ 이행과 ④ 결과물'

/** 판정 이유: 어느 규칙에 어떤 축 때문에 걸렸는지 한두 문장으로 */
export function vendorVerdictReason(
  axes: VendorAxisStatuses,
  evidence: VendorAxisEvidence = {},
): string {
  const fixes = VENDOR_AXIS_IDS.filter((a) => axes[a] === 'fix')
  switch (vendorOverallRule(axes, evidence)) {
    case 0: {
      const name = axisName(axes.delivery === 'fix' ? 'delivery' : 'output')
      return `핵심 축인 ${subject(name)} ‘개선 필요’입니다. ③ 이행이나 ④ 결과물이 ‘개선 필요’이면 종합 판정도 ‘개선 필요’입니다.`
    }
    case 1:
      return '⑥ 이력에 이 계약과 같은 종류의 확정 처분이 있어 ‘개선 필요’입니다.'
    case 2:
      return '② 약속과 ⑤ 금액이 모두 ‘개선 필요’입니다. 두 축이 함께 ‘개선 필요’이면 종합 판정도 ‘개선 필요’입니다.'
    case 3:
      return `${CORE_PAIR}을 아직 판단할 수 없고 ‘개선 필요’인 축이 없어 ‘아직 판단 불가’입니다.`
    case 4: {
      const core = CORE.filter((a) => axes[a] !== 'on-track').map(axisName)
      const parts = [
        fixes.length
          ? `‘개선 필요’는 ${fixes.map(axisName).join(' · ')}입니다.`
          : '',
        core.length ? `${subject(core.join('과 '))} ‘순항’이 아닙니다.` : '',
      ].filter(Boolean)
      return `${parts.join(' ')} 이때 종합 판정은 ‘지켜볼 점 있음’입니다.`
    }
    case 5: {
      const thin = CORE.filter((a) => evidence[a] === 'thin')
        .map(axisName)
        .join('과 ')
      return `${CORE_PAIR}이 ‘순항’이지만 ${thin}의 근거가 부족합니다. 핵심 축 가운데 하나라도 근거가 부족하면 종합 판정은 ‘지켜볼 점 있음’까지입니다.`
    }
    default:
      return `${CORE_PAIR}이 ‘순항’이고 ‘개선 필요’인 축이 없어 ‘순항’입니다.`
  }
}
