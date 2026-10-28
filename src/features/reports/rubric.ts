import type { Area, Check, CheckResult, Grade } from './schema'

export const RUBRIC_VERSION = '0.4'

/** 점검 대상 금액 대비 이 비율 미만인 지적은 경미한 지적으로 보고 등급에 넣지 않는다 */
export const MINOR_SHARE = 0.01

export const GRADE_INFO: Record<Grade, { label: string; definition: string }> =
  {
    good: {
      label: '양호',
      definition:
        '점검 결과 문제가 없고, 확인된 항목이 확인 못 한 항목보다 많다.',
    },
    caution: {
      label: '주의',
      definition: '명백한 위반은 없지만, 설명이 부족하거나 위험 신호가 있다.',
    },
    poor: {
      label: '미흡',
      definition: '공개 자료로 확인된 문제가 하나 이상 있다.',
    },
    insufficient: {
      label: '판단 보류',
      definition: '공개된 자료가 부족해 확인하지 못한 항목이 더 많다.',
    },
  }

export const RESULT_INFO: Record<CheckResult, { label: string; mark: string }> =
  {
    pass: { label: '확인됨', mark: '○' },
    warn: { label: '주의', mark: '△' },
    fail: { label: '문제', mark: '✕' },
    unknown: { label: '확인 불가', mark: '?' },
  }

export const AREA_INFO: Record<Area, { label: string; question: string }> = {
  budget: {
    label: '예산 편성',
    question: '돈을 왜 이만큼 잡았는지, 산출 근거가 있고 타당한가?',
  },
  execution: {
    label: '집행',
    question: '잡은 돈이 계획한 곳에 제때 쓰이고 있는가?',
  },
  contract: {
    label: '계약',
    question: '업체를 경쟁으로 골랐는가? 수의계약이라면 법적 사유가 있는가?',
  },
  process: {
    label: '절차',
    question:
      '의회 심의 등 정해진 절차를 거쳤고, 절차보다 앞서 진행하지 않았는가?',
  },
  outcome: {
    label: '성과',
    question: '목표한 결과가 숫자로 확인되는가?',
  },
  oversight: {
    label: '감시·감사',
    question:
      '시 감사부서·의회·상급기관이 실제로 들여다봤고, 지적한 뒤 고쳐졌는지 끝까지 확인했는가?',
  },
  disclosure: {
    label: '정보 공개',
    question: '시민이 위 내용을 확인할 수 있게 자료가 공개돼 있는가?',
  },
}

type Weighable = Pick<Check, 'result'> &
  Partial<Pick<Check, 'group' | 'amount'>>

export interface GradeOptions {
  /** 점검 대상 금액(원). 있으면 지적별 비중을 따진다 */
  total?: number
}

/** 등급 계산에서 빠지는 이유: 같은 원인의 다른 점검에 묶임 / 금액 비중이 작음 */
export type Exclusion = 'grouped' | 'minor'

export const EXCLUSION_INFO: Record<Exclusion, string> = {
  grouped: '같은 원인 · 종합 등급에 한 번만 셈',
  minor: '경미 · 등급 미반영',
}

const SEVERITY: Record<CheckResult, number> = {
  fail: 3,
  warn: 2,
  unknown: 1,
  pass: 0,
}

const isFlagged = (c: Weighable) => c.result === 'warn' || c.result === 'fail'

/** 점검 대상 금액의 1%에 못 미치는 주의·문제 (금액 0은 금액과 무관한 지적으로 본다) */
function isMinor(c: Weighable, total?: number): boolean {
  return (
    isFlagged(c) &&
    total !== undefined &&
    c.amount !== undefined &&
    c.amount > 0 &&
    c.amount < total * MINOR_SHARE
  )
}

/** 묶음 대표: 결과가 무거운 것 → 경미하지 않은 것 → 금액이 큰 것(금액 없음은 가장 크게) 순 */
function leadOf<T extends Weighable>(
  members: ReadonlyArray<T>,
  total?: number,
): T {
  const weight = (c: T) => [
    SEVERITY[c.result],
    isMinor(c, total) ? 0 : 1,
    c.amount ?? Number.POSITIVE_INFINITY,
  ]
  return members.reduce((a, b) => {
    const [wa, wb] = [weight(a), weight(b)]
    const k = wa.findIndex((v, n) => v !== wb[n])
    return k >= 0 && wb[k] > wa[k] ? b : a
  })
}

export function exclusionOf<T extends Weighable>(
  check: T,
  all: ReadonlyArray<T>,
  { total }: GradeOptions = {},
): Exclusion | undefined {
  // 묶음은 주의·문제끼리만: 같은 원인의 지적을 한 번만 센다
  if (check.group && isFlagged(check)) {
    const members = all.filter((c) => c.group === check.group && isFlagged(c))
    if (leadOf(members, total) !== check) return 'grouped'
  }
  return isMinor(check, total) ? 'minor' : undefined
}

export function countedChecks<T extends Weighable>(
  checks: ReadonlyArray<T>,
  opts: GradeOptions = {},
): Array<T> {
  return checks.filter((c) => exclusionOf(c, checks, opts) === undefined)
}

/**
 * 등급 규칙(공개): 같은 원인은 한 번만, 대상 금액의 1% 미만 지적은 빼고 센다.
 * 문제 1건 이상 → 미흡 / 주의 1건 이상 → 주의 /
 * 확인된 항목이 확인 불가보다 적으면 → 판단 보류 / 그 외 → 양호
 */
export function gradeOf(
  checks: ReadonlyArray<Weighable>,
  opts: GradeOptions = {},
): Grade {
  const counted = countedChecks(checks, opts)
  const n = (r: CheckResult) => counted.filter((c) => c.result === r).length
  if (n('fail') > 0) return 'poor'
  if (n('warn') > 0) return 'caution'
  if (n('pass') === 0 || n('pass') < n('unknown')) return 'insufficient'
  return 'good'
}

export function countResults(
  checks: ReadonlyArray<Pick<Check, 'result'>>,
): Record<CheckResult, number> {
  return {
    pass: checks.filter((c) => c.result === 'pass').length,
    warn: checks.filter((c) => c.result === 'warn').length,
    fail: checks.filter((c) => c.result === 'fail').length,
    unknown: checks.filter((c) => c.result === 'unknown').length,
  }
}
