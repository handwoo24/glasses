import { describe, expect, it } from 'vitest'
import type { ReportSummary } from '#/features/reports/summary'
import {
  distribution,
  filterReports,
  isoOf,
  listedReport,
  nextDateOf,
  sidoOf,
  won,
  ProgramsSearchSchema,
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

describe('사업 목록 필터', () => {
  it('시도 코드는 기초자치단체의 5자리 지역도 고른다', () => {
    expect(
      filterReports(rows, { region: '41' }, '2026-10-29').map(
        (r) => r.summary.slug,
      ),
    ).toEqual(['bus', 'ev'])
  })

  it('부처는 국고보조사업의 중앙 부처로도 고른다', () => {
    expect(
      filterReports(rows, { ministry: '1613000' }, '2026-10-29').map(
        (r) => r.summary.slug,
      ),
    ).toEqual(['bus'])
  })

  it('기본 정렬은 다음 판단 시점이 가까운 순이고 날짜가 없으면 뒤', () => {
    expect(
      filterReports(rows, {}, '2026-10-29').map((r) => r.summary.slug),
    ).toEqual(['bus', 'ev', 'seoul'])
  })

  it('최근 평가 순과 무거운 판정 순', () => {
    expect(
      filterReports(rows, { sort: 'recent' }, '2026-10-29').map(
        (r) => r.summary.slug,
      ),
    ).toEqual(['seoul', 'bus', 'ev'])
    expect(
      filterReports(rows, { sort: 'heavy', field: '환경' }, '2026-10-29').map(
        (r) => r.summary.slug,
      ),
    ).toEqual(['ev', 'seoul'])
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

describe('주소 검색 조건', () => {
  it('숫자로 읽힌 지역·부처 코드도 받는다', () => {
    expect(
      ProgramsSearchSchema.parse({ region: 41, ministry: 1613000 }),
    ).toEqual({ region: '41', ministry: '1613000' })
  })
  it('틀린 값은 버린다', () => {
    expect(ProgramsSearchSchema.parse({ region: '4', verdict: 'x' })).toEqual(
      {},
    )
  })
})
