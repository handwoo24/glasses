import { describe, expect, test } from 'vitest'
import { getReport, reports } from './index'

describe('게시 리포트', () => {
  test('모든 리포트가 양식을 통과하고 slug가 겹치지 않는다', () => {
    expect(reports.length).toBeGreaterThan(0)
    expect(new Set(reports.map((r) => r.slug)).size).toBe(reports.length)
  })

  test('slug로 찾을 수 있고, 없는 slug는 undefined', () => {
    expect(getReport(reports[0].slug)?.title).toBe(reports[0].title)
    expect(getReport('nope')).toBeUndefined()
  })

  test('제3회 추경 총액이 예산서 숫자와 맞는다', () => {
    const r = getReport('budget-2026-3rd-supplementary')!
    const f = r.moneyFlow!
    expect(f.end.amount).toBe(3_762_971_365)
    expect(f.end.amount - f.start.amount).toBe(163_922_216)
  })
})
