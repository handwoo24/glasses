import { describe, expect, test } from 'vitest'
import { overallEvidence, overallRule, overallStatus } from './axes'
import type { AxisStatus, AxisStatuses } from './axes'

const axes = (over: Partial<AxisStatuses> = {}): AxisStatuses => ({
  goal: 'on-track',
  progress: 'on-track',
  outcome: 'on-track',
  cost: 'on-track',
  execution: 'on-track',
  sustainability: 'on-track',
  accountability: 'on-track',
  ...over,
})

describe('overallStatus (종합 판정 규칙, 위에서부터 처음 해당하는 것)', () => {
  test('진척이나 성과가 개선 필요면 개선 필요', () => {
    expect(overallStatus(axes({ progress: 'fix' }))).toBe('fix')
    expect(overallStatus(axes({ outcome: 'fix' }))).toBe('fix')
  })

  test('개선 필요인 축이 두 개 이상이면 개선 필요', () => {
    expect(overallStatus(axes({ cost: 'fix', accountability: 'fix' }))).toBe(
      'fix',
    )
  })

  test('진척·성과가 모두 판단 불가이고 개선 필요가 없으면 아직 판단 불가', () => {
    expect(
      overallStatus(axes({ progress: 'unknown', outcome: 'unknown' })),
    ).toBe('unknown')
  })

  test('진척·성과가 판단 불가여도 다른 축에 개선 필요가 있으면 판단 불가로 가리지 않는다', () => {
    expect(
      overallStatus(
        axes({ progress: 'unknown', outcome: 'unknown', cost: 'fix' }),
      ),
    ).toBe('watch')
  })

  test('개선 필요가 하나이거나 핵심 축이 순항이 아니면 지켜볼 점 있음', () => {
    expect(overallStatus(axes({ cost: 'fix' }))).toBe('watch')
    expect(overallStatus(axes({ outcome: 'watch' }))).toBe('watch')
    expect(overallStatus(axes({ progress: 'unknown' }))).toBe('watch')
  })

  test('핵심 축이 순항이고 개선 필요가 없으면 순항', () => {
    expect(overallStatus(axes({ goal: 'watch', cost: 'unknown' }))).toBe(
      'on-track',
    )
  })

  test('평가 체계 보고서의 달릴고양 적용 예는 개선 필요', () => {
    const dallil: Record<string, AxisStatus> = {
      goal: 'unknown',
      progress: 'watch',
      outcome: 'unknown',
      cost: 'fix',
      execution: 'watch',
      sustainability: 'fix',
      accountability: 'fix',
    }
    expect(overallStatus(dallil as AxisStatuses)).toBe('fix')
  })
})

describe('overallRule (몇 번째 규칙에 걸렸나, 0부터)', () => {
  test('규칙 순서대로 처음 해당하는 줄의 번호를 돌려준다', () => {
    expect(overallRule(axes({ progress: 'fix' }))).toBe(0)
    expect(overallRule(axes({ cost: 'fix', accountability: 'fix' }))).toBe(1)
    expect(overallRule(axes({ progress: 'unknown', outcome: 'unknown' }))).toBe(
      2,
    )
    expect(overallRule(axes({ cost: 'fix' }))).toBe(3)
    expect(overallRule(axes())).toBe(4)
  })

  test('핵심 축이 개선 필요면 다른 축 개수보다 먼저 0번 규칙', () => {
    expect(
      overallRule(axes({ outcome: 'fix', cost: 'fix', accountability: 'fix' })),
    ).toBe(0)
  })
})

describe('overallEvidence (종합 근거 수준)', () => {
  test('충분이 과반이면 높음', () => {
    expect(
      overallEvidence(['full', 'full', 'full', 'full', 'thin', 'thin', 'thin']),
    ).toBe('high')
  })

  test('부족이 과반이면 낮음', () => {
    expect(
      overallEvidence([
        'thin',
        'thin',
        'thin',
        'thin',
        'full',
        'partial',
        'partial',
      ]),
    ).toBe('low')
  })

  test('어느 쪽도 과반이 아니면 중간 (달릴고양: 충분 2, 일부 3, 부족 2)', () => {
    expect(
      overallEvidence([
        'thin',
        'partial',
        'thin',
        'partial',
        'partial',
        'full',
        'full',
      ]),
    ).toBe('medium')
  })
})
