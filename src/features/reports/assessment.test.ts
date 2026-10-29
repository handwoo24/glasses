import { describe, expect, test } from 'vitest'
import {
  answerCounts,
  groupByStatus,
  summarize,
  verdictReason,
} from './assessment'
import type { AxisId, AxisStatus } from './axes'
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

describe('verdictReason (판정 이유 한두 문장)', () => {
  const statuses = (over: Partial<Record<AxisId, AxisStatus>>) =>
    Object.fromEntries(
      AXIS_IDS.map((a) => [a, over[a] ?? 'on-track']),
    ) as Record<AxisId, AxisStatus>

  test('개선 필요가 두 축 이상이면 그 축을 모두 적는다 (달릴고양)', () => {
    expect(
      verdictReason(
        statuses({
          goal: 'unknown',
          progress: 'watch',
          outcome: 'unknown',
          cost: 'fix',
          execution: 'watch',
          sustainability: 'fix',
          accountability: 'fix',
        }),
      ),
    ).toBe(
      '④ 비용 · ⑥ 지속성 · ⑦ 투명성·책임 세 축이 ‘개선 필요’입니다. ‘개선 필요’가 두 축 이상이면 종합 판정도 ‘개선 필요’입니다.',
    )
  })

  test('개선 필요가 하나이고 핵심 축이 순항이 아니면 둘 다 적는다 (전기차 보조금)', () => {
    expect(
      verdictReason(
        statuses({
          goal: 'watch',
          progress: 'watch',
          cost: 'watch',
          execution: 'watch',
          sustainability: 'fix',
          accountability: 'watch',
        }),
      ),
    ).toBe(
      '‘개선 필요’는 ⑥ 지속성 하나이고, ② 진척이 ‘순항’이 아닙니다. ‘개선 필요’가 한 축이거나 ②·③ 가운데 ‘순항’이 아닌 축이 있으면 ‘지켜볼 점 있음’입니다.',
    )
  })

  test('개선 필요 없이 핵심 축만 순항이 아니면 그 축만 적는다', () => {
    expect(verdictReason(statuses({ outcome: 'watch' }))).toBe(
      '③ 성과가 ‘순항’이 아닙니다. ‘개선 필요’가 한 축이거나 ②·③ 가운데 ‘순항’이 아닌 축이 있으면 ‘지켜볼 점 있음’입니다.',
    )
    expect(
      verdictReason(statuses({ progress: 'watch', outcome: 'unknown' })),
    ).toBe(
      '② 진척과 ③ 성과가 ‘순항’이 아닙니다. ‘개선 필요’가 한 축이거나 ②·③ 가운데 ‘순항’이 아닌 축이 있으면 ‘지켜볼 점 있음’입니다.',
    )
  })

  test('개선 필요가 하나이고 핵심 축이 순항이면 그 축만 적는다', () => {
    expect(verdictReason(statuses({ cost: 'fix' }))).toBe(
      '‘개선 필요’는 ④ 비용 하나입니다. ‘개선 필요’가 한 축이거나 ②·③ 가운데 ‘순항’이 아닌 축이 있으면 ‘지켜볼 점 있음’입니다.',
    )
  })

  test('핵심 축이 개선 필요면 그 축을 적는다', () => {
    expect(verdictReason(statuses({ progress: 'fix', cost: 'fix' }))).toBe(
      '핵심 축인 ② 진척이 ‘개선 필요’입니다. ② 진척이나 ③ 성과가 ‘개선 필요’이면 종합 판정도 ‘개선 필요’입니다.',
    )
  })

  test('판단 불가와 순항', () => {
    expect(
      verdictReason(statuses({ progress: 'unknown', outcome: 'unknown' })),
    ).toBe(
      '② 진척과 ③ 성과를 아직 판단할 수 없고 ‘개선 필요’인 축이 없어 ‘아직 판단 불가’입니다.',
    )
    expect(verdictReason(statuses({}))).toBe(
      '② 진척과 ③ 성과가 ‘순항’이고 ‘개선 필요’인 축이 없어 ‘순항’입니다.',
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

describe('groupByStatus', () => {
  test('나쁜 상태부터 묶고, 없는 상태는 빼며, 축 순서를 지킨다', () => {
    const g = groupByStatus(
      assessment({
        goal: { status: 'watch' },
        outcome: { status: 'unknown' },
        cost: { status: 'watch' },
        sustainability: { status: 'fix' },
      }).axes,
    )
    expect(g).toEqual([
      { status: 'fix', axes: ['sustainability'] },
      { status: 'watch', axes: ['goal', 'cost'] },
      { status: 'on-track', axes: ['progress', 'execution', 'accountability'] },
      { status: 'unknown', axes: ['outcome'] },
    ])
  })
})
