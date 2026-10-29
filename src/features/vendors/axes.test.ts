import { describe, expect, test } from 'vitest'
import {
  VENDOR_AXES,
  vendorOverallRule,
  vendorOverallStatus,
  vendorVerdictReason,
} from './axes'
import type { VendorAxisEvidence, VendorAxisStatuses } from './axes'

const axes = (over: Partial<VendorAxisStatuses> = {}): VendorAxisStatuses => ({
  selection: 'on-track',
  scope: 'on-track',
  delivery: 'on-track',
  output: 'on-track',
  cost: 'on-track',
  record: 'on-track',
  ...over,
})

describe('업체 축', () => {
  test('문서 제목에 쓰는 이름은 번호와 이름이다', () => {
    expect(VENDOR_AXES.ids.map((a) => VENDOR_AXES.name(a))).toEqual([
      '① 선정',
      '② 약속',
      '③ 이행',
      '④ 결과물',
      '⑤ 금액',
      '⑥ 이력',
    ])
  })
})

describe('vendorOverallStatus (업체 종합 판정, 위에서부터 처음 해당하는 것)', () => {
  test('이행이나 결과물이 개선 필요면 개선 필요', () => {
    expect(vendorOverallStatus(axes({ delivery: 'fix' }))).toBe('fix')
    expect(vendorOverallStatus(axes({ output: 'fix' }))).toBe('fix')
  })

  test('이력에 확정 처분(개선 필요)이 있으면 개선 필요', () => {
    expect(vendorOverallStatus(axes({ record: 'fix' }))).toBe('fix')
  })

  test('약속과 금액이 둘 다 개선 필요면 개선 필요', () => {
    expect(vendorOverallStatus(axes({ scope: 'fix', cost: 'fix' }))).toBe('fix')
  })

  test('발주기관 몫인 선정은 개선 필요여도 지켜볼 점까지만 끌어내린다', () => {
    expect(vendorOverallStatus(axes({ selection: 'fix' }))).toBe('watch')
    expect(vendorOverallStatus(axes({ selection: 'fix', scope: 'fix' }))).toBe(
      'watch',
    )
  })

  test('이행·결과물이 모두 판단 불가이고 개선 필요가 없으면 아직 판단 불가', () => {
    expect(
      vendorOverallStatus(axes({ delivery: 'unknown', output: 'unknown' })),
    ).toBe('unknown')
  })

  test('이행·결과물 중 하나라도 순항이 아니면 지켜볼 점 있음', () => {
    expect(vendorOverallStatus(axes({ output: 'watch' }))).toBe('watch')
    expect(vendorOverallStatus(axes({ delivery: 'unknown' }))).toBe('watch')
  })

  test('이행·결과물이 순항이어도 근거가 부족하면 지켜볼 점 있음까지', () => {
    const thin: VendorAxisEvidence = { output: 'thin' }
    expect(vendorOverallStatus(axes(), thin)).toBe('watch')
    expect(vendorOverallStatus(axes(), { record: 'thin' })).toBe('on-track')
  })

  test('삼성티엔지 예시는 결과물 근거 부족으로 지켜볼 점 있음', () => {
    const statuses = axes({
      selection: 'watch',
      scope: 'unknown',
      cost: 'watch',
    })
    const levels: VendorAxisEvidence = {
      selection: 'full',
      scope: 'partial',
      delivery: 'partial',
      output: 'thin',
      cost: 'partial',
      record: 'partial',
    }
    expect(vendorOverallRule(statuses, levels)).toBe(5)
    expect(vendorOverallStatus(statuses, levels)).toBe('watch')
    expect(vendorVerdictReason(statuses, levels)).toBe(
      '③ 이행과 ④ 결과물이 ‘순항’이지만 ④ 결과물의 근거가 부족합니다. 핵심 축 가운데 하나라도 근거가 부족하면 종합 판정은 ‘지켜볼 점 있음’까지입니다.',
    )
  })

  test('핵심 축이 순항이고 근거도 있으면 다른 축의 지켜볼 점과 상관없이 순항', () => {
    expect(vendorOverallStatus(axes({ scope: 'watch' }))).toBe('on-track')
    expect(vendorOverallStatus(axes())).toBe('on-track')
  })
})
