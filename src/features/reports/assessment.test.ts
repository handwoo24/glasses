import { describe, expect, test } from 'vitest'
import {
  answerCounts,
  classifyChecks,
  overallReason,
  signalsByAxis,
  staleCheckKeys,
  summarize,
} from './assessment'
import type { Assessment, AxisAssessment } from './assessment'
import type { AxisId } from './axes'
import { AXIS_IDS } from './axes'

const axis = (over: Partial<AxisAssessment> = {}): AxisAssessment => ({
  status: 'on-track',
  evidence: 'full',
  line: '한 줄',
  title: '제목',
  ...over,
})

const assessment = (
  axes: Partial<Record<AxisId, Partial<AxisAssessment>>> = {},
  extra: Partial<Assessment> = {},
): Pick<Assessment, 'axes' | 'checkMap' | 'newChecks' | 'signalAxis'> => ({
  axes: Object.fromEntries(AXIS_IDS.map((a) => [a, axis(axes[a])])) as Record<
    AxisId,
    AxisAssessment
  >,
  checkMap: {},
  ...extra,
})

describe('summarize', () => {
  test('핵심 축이 개선 필요면 종합도 개선 필요이고, 개선 필요 축 수를 센다', () => {
    const s = summarize(
      assessment({ outcome: { status: 'fix' }, cost: { status: 'fix' } }),
    )
    expect(s.overall).toBe('fix')
    expect(s.fixCount).toBe(2)
  })

  test('근거 충분이 과반이면 종합 근거 수준은 높음', () => {
    const s = summarize(
      assessment({ goal: { evidence: 'thin' }, cost: { evidence: 'partial' } }),
    )
    expect(s.evidence).toBe('high')
  })
})

describe('overallReason', () => {
  test('판정마다 이유 문장이 다르다', () => {
    expect(overallReason('fix', 3)).toBe('‘개선 필요’인 축이 3개여서')
    expect(overallReason('watch', 0)).toBe(
      '‘개선 필요’인 축은 없지만 핵심 축(②·③)이 모두 ‘순항’은 아니어서',
    )
    expect(overallReason('watch', 1)).toBe(
      '‘개선 필요’인 축이 1개이고 핵심 축이 모두 ‘순항’은 아니어서',
    )
    expect(overallReason('unknown', 0)).toBe(
      '핵심 축(②·③)을 아직 판단할 수 없어',
    )
    expect(overallReason('on-track', 0)).toBe(
      '핵심 축이 순항이고 ‘개선 필요’인 축이 없어',
    )
  })
})

describe('classifyChecks', () => {
  const report = {
    checks: [
      {
        question: '경쟁으로 골랐나?',
        finding: '단독 응모',
        criterion: '경쟁',
        cite: ['s1'],
      },
    ],
  }

  test('리포트 점검을 축과 답으로 다시 매기고 새 점검을 뒤에 붙인다', () => {
    const a = assessment(
      {},
      {
        checkMap: { '경쟁으로 골랐나?': ['cost', 'no', '경쟁이 있었는가'] },
        newChecks: [
          {
            axis: 'goal',
            answer: 'none',
            question: '목표가 있는가',
            finding: '찾지 못했다.',
            criterion: '수치 목표',
            cite: [],
          },
        ],
      },
    )
    const checks = classifyChecks(report, a)
    expect(checks).toEqual([
      {
        axis: 'cost',
        answer: 'no',
        question: '경쟁이 있었는가',
        finding: '단독 응모',
        criterion: '경쟁',
        cite: ['s1'],
      },
      {
        axis: 'goal',
        answer: 'none',
        question: '목표가 있는가',
        finding: '찾지 못했다.',
        criterion: '수치 목표',
        cite: [],
      },
    ])
    expect(answerCounts(checks)).toEqual({ yes: 0, no: 1, open: 0, none: 1 })
  })

  test('축이 정해지지 않은 점검이 있으면 실패한다', () => {
    expect(() => classifyChecks(report, assessment())).toThrow(
      '축이 정해지지 않은 점검: 경쟁으로 골랐나?',
    )
  })
})

describe('signalsByAxis', () => {
  const report = {
    riskSignals: [
      {
        signal: '단독 응찰',
        status: 'detected',
        severity: 'high',
        detail: '1곳',
        cite: ['s1'],
      },
    ] as const,
  }

  test('위험 지표를 축별로 묶는다', () => {
    const map = signalsByAxis(
      report,
      assessment({}, { signalAxis: { '단독 응찰': 'cost' } }),
    )
    expect(map.cost.map((s) => s.signal)).toEqual(['단독 응찰'])
    expect(map.goal).toEqual([])
  })

  test('축이 정해지지 않은 지표가 있으면 실패한다', () => {
    expect(() => signalsByAxis(report, assessment())).toThrow(
      '축이 정해지지 않은 지표: 단독 응찰',
    )
  })
})

describe('표 이름 조회', () => {
  test('Object 기본 속성 이름도 정해지지 않은 점검으로 본다', () => {
    const report = {
      checks: [
        { question: 'toString', finding: '-', criterion: '-', cite: [] },
      ],
    }
    expect(() => classifyChecks(report, assessment())).toThrow(
      '축이 정해지지 않은 점검: toString',
    )
  })

  test('없는 축 이름으로 묶은 지표는 실패한다', () => {
    const report = {
      riskSignals: [
        {
          signal: '단독 응찰',
          status: 'detected',
          severity: 'high',
          detail: '1곳',
          cite: ['s1'],
        },
      ] as const,
    }
    const a = assessment({}, { signalAxis: { '단독 응찰': 'price' as never } })
    expect(() => signalsByAxis(report, a)).toThrow('없는 축: price')
  })

  test('리포트에 없는 질문이 남은 재분류 항목을 찾는다', () => {
    const report = { checks: [{ question: '있다?' }] }
    const a = assessment(
      {},
      {
        checkMap: {
          '있다?': ['goal', 'yes', '있는가'],
          '사라졌다?': ['goal', 'no', '사라졌는가'],
        },
      },
    )
    expect(staleCheckKeys(report, a)).toEqual(['사라졌다?'])
  })
})
