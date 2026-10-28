import { describe, expect, test } from 'vitest'
import { loadReportDoc } from './doc/load'
import md from './doc/__fixtures__/autonomous-bus.md?raw'
import { ReportSummarySchema, reportPath, toSummary } from './summary'

describe('게시 요약 (홈·목록이 리포트 원문 없이 쓰는 것)', () => {
  const doc = {
    ...loadReportDoc(md),
    subject: 'programs/3940000.autonomous-bus',
  }

  test('리포트에서 만든 요약은 양식을 통과하고 JSON으로 주고받아도 같다', () => {
    const summary = toSummary(doc)
    const wire = JSON.parse(JSON.stringify(summary)) as unknown
    expect(ReportSummarySchema.parse(wire)).toEqual(summary)
    expect(summary.subject).toBe('programs/3940000.autonomous-bus')
    expect(summary.nextDates[0].date).toBe('2026-11-10')
    expect(summary.axes.cost).toEqual({ status: 'fix', evidence: 'partial' })
  })

  test('축이 하나라도 빠지면 양식 오류', () => {
    const { cost: _cost, ...rest } = toSummary(doc).axes
    expect(() =>
      ReportSummarySchema.parse({ ...toSummary(doc), axes: rest }),
    ).toThrow()
  })
})

describe('reportPath (리포트 화면 주소 = 평가 대상 경로)', () => {
  test('사업과 재정 문서', () => {
    expect(reportPath('programs/3940000.autonomous-bus')).toBe(
      '/programs/3940000.autonomous-bus',
    )
    expect(reportPath('orgs/3940000/budgets/2026-supplementary-3')).toBe(
      '/orgs/3940000/budgets/2026-supplementary-3',
    )
  })
})
