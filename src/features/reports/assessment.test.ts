import { describe, expect, test } from 'vitest'
import { answerCounts, overallReason, summarize } from './assessment'
import type { AxisId } from './axes'
import { AXIS_IDS } from './axes'
import type { AxisDoc } from './report-doc'

type Judged = Pick<AxisDoc, 'status' | 'evidence'>

const assessment = (axes: Partial<Record<AxisId, Partial<Judged>>> = {}) => ({
  axes: Object.fromEntries(
    AXIS_IDS.map((a): [AxisId, Judged] => [
      a,
      { status: 'on-track', evidence: 'full', ...axes[a] },
    ]),
  ) as Record<AxisId, Judged>,
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

describe('answerCounts', () => {
  test('답별 점검 수를 센다', () => {
    expect(
      answerCounts([{ answer: 'yes' }, { answer: 'open' }, { answer: 'open' }]),
    ).toEqual({ yes: 1, no: 0, open: 2, none: 0 })
  })
})
