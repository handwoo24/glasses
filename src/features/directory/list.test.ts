import { describe, expect, it } from 'vitest'
import type { ReportSummary } from '#/features/reports/summary'
import {
  distribution,
  heavyFirst,
  isoOf,
  listedReport,
  nextDateOf,
  sidoOf,
  won,
} from './list'

const axes = (status: 'on-track' | 'watch' | 'fix' | 'unknown') =>
  Object.fromEntries(
    [
      'goal',
      'progress',
      'outcome',
      'cost',
      'execution',
      'sustainability',
      'accountability',
    ].map((a) => [a, { status, evidence: 'full' as const }]),
  ) as ReportSummary['axes']

function summary(
  slug: string,
  status: 'on-track' | 'watch' | 'fix' | 'unknown',
  asOf: string,
  next?: string,
): ReportSummary {
  return {
    slug,
    subject: `programs/3940000.${slug}`,
    project: '사업',
    title: slug,
    asOf,
    nextDates: next ? [{ when: next, what: '보고', date: next }] : [],
    axes: axes(status),
  }
}

const rows = [
  listedReport(summary('bus', 'fix', '2026. 10. 27.', '2026-11-10'), {
    kind: 'program',
    org: '3940000',
    orgName: '고양특례시',
    region: '41280',
    ministries: ['1613000'],
    sector: '수송및교통',
  }),
  listedReport(summary('ev', 'watch', '2026. 10. 20.', '2026-12-01'), {
    kind: 'program',
    org: '3940000',
    orgName: '고양특례시',
    region: '41280',
    ministries: [],
    sector: '환경',
  }),
  listedReport(summary('seoul', 'on-track', '2026. 10. 28.'), {
    kind: 'program',
    org: '6110000',
    orgName: '서울특별시',
    region: '11',
    ministries: [],
    sector: '환경',
  }),
]

describe('게시 리포트 목록', () => {
  it('판정이 무거운 순, 같으면 최근 평가 순', () => {
    expect(heavyFirst(rows).map((r) => r.summary.slug)).toEqual([
      'bus',
      'ev',
      'seoul',
    ])
  })

  it('지난 판단 시점은 다음 판단 시점이 아니다', () => {
    expect(nextDateOf(rows[0].summary, '2026-11-11')).toBeUndefined()
  })

  it('판정 분포를 센다', () => {
    expect(distribution(rows)).toEqual({
      fix: 1,
      watch: 1,
      'on-track': 1,
      unknown: 0,
    })
  })
})

describe('표기', () => {
  it('화면 날짜를 ISO로', () => {
    expect(isoOf('2026. 9. 3.')).toBe('2026-09-03')
  })
  it('시도 이름', () => {
    expect(sidoOf('41280')).toBe('경기도')
    expect(sidoOf(undefined)).toBeUndefined()
  })
  it('금액', () => {
    expect(won(3_421_000_000_000)).toBe('3조 4,210억 원')
    expect(won(34_000_000_000)).toBe('340억 원')
    expect(won(80_000_000)).toBe('8천만 원')
  })
})
