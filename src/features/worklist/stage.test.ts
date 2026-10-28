import { describe, expect, it } from 'vitest'
import { stageOf } from './stage'
import type { SubjectProgress } from './stage'

const empty: SubjectProgress = {
  materials: 0,
  facts: 0,
  absences: 0,
  reports: [],
  reviews: [],
  published: false,
}
const written = '2026-10-28T09:00:00+09:00'
const reviewed = '2026-10-28T10:00:00+09:00'
const report = (
  asOf: string,
  status: SubjectProgress['reports'][number]['status'],
  updatedAt = written,
) => ({ asOf, status, updatedAt })

describe('stageOf', () => {
  it('산출물이 없으면 대기', () => {
    expect(stageOf(empty)).toBe('대기')
  })

  it('자료만 있으면 수집, 사실이나 부재 기록이 있으면 분석', () => {
    expect(stageOf({ ...empty, materials: 3 })).toBe('수집')
    expect(stageOf({ ...empty, materials: 3, facts: 1 })).toBe('분석')
    expect(stageOf({ ...empty, absences: 1 })).toBe('분석')
  })

  it('리포트 초안은 작성, 검토 요청은 검증', () => {
    expect(
      stageOf({ ...empty, facts: 5, reports: [report('2026-10-28', 'draft')] }),
    ).toBe('작성')
    expect(
      stageOf({ ...empty, reports: [report('2026-10-28', 'in-review')] }),
    ).toBe('검증')
  })

  it('가장 늦은 판에 대한 마지막 검증 결과를 따른다', () => {
    const reports = [report('2026-10-28', 'in-review')]
    const fail = {
      report: '2026-10-28',
      verdict: 'fail' as const,
      reviewedAt: reviewed,
    }
    expect(stageOf({ ...empty, reports, reviews: [fail] })).toBe('고침')
    expect(
      stageOf({
        ...empty,
        reports,
        reviews: [
          fail,
          { ...fail, verdict: 'pass', reviewedAt: '2026-10-29T09:00:00+09:00' },
        ],
      }),
    ).toBe('게시 대기')
  })

  it('검증 뒤에 고친 리포트는 다시 검증을 기다린다', () => {
    expect(
      stageOf({
        ...empty,
        reports: [
          report('2026-10-28', 'in-review', '2026-10-28T11:00:00+09:00'),
        ],
        reviews: [
          { report: '2026-10-28', verdict: 'fail', reviewedAt: reviewed },
        ],
      }),
    ).toBe('검증')
  })

  it('지난 판의 검증은 새 판에 쓰지 않는다', () => {
    expect(
      stageOf({
        ...empty,
        reports: [
          report('2026-10-01', 'published'),
          report('2026-10-28', 'draft'),
        ],
        reviews: [
          { report: '2026-10-01', verdict: 'pass', reviewedAt: reviewed },
        ],
      }),
    ).toBe('작성')
  })

  it('게시 문서가 있으면 게시, 게시한 사업에 새 판을 쓰는 중이면 그 판의 단계', () => {
    const published = report('2026-10-01', 'published')
    expect(stageOf({ ...empty, reports: [published], published: true })).toBe(
      '게시',
    )
    expect(
      stageOf({
        ...empty,
        reports: [published, report('2026-12-01', 'draft')],
        published: true,
      }),
    ).toBe('작성')
  })
})
