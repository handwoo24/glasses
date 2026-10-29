// 사업 목록(/programs)과 기관 페이지가 함께 쓰는 게시 리포트 목록: 지역·부처·분야·판정 필터와 정렬.
// 주소의 검색 조건(?region=&ministry=&field=&verdict=&kind=&sort=)으로 정한다.
import { z } from 'zod'
import { summarize } from '#/features/reports/assessment'
import { AXIS_STATUSES } from '#/features/reports/axes'
import type { AxisStatus } from '#/features/reports/axes'
import type { ReportSummary } from '#/features/reports/summary'
import { ORG_ID } from '#/pipeline/schemas'
import { PageSchema } from './paging'
import type { Org } from '#/pipeline/schemas'

/** 시도 행정구역 코드 2자리 → 이름 (행정표준코드관리시스템 법정동 코드) */
export const SIDO: Readonly<Record<string, string>> = {
  '11': '서울특별시',
  '26': '부산광역시',
  '27': '대구광역시',
  '28': '인천광역시',
  '29': '광주광역시',
  '30': '대전광역시',
  '31': '울산광역시',
  '36': '세종특별자치시',
  '41': '경기도',
  '43': '충청북도',
  '44': '충청남도',
  '46': '전라남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주특별자치도',
  '51': '강원특별자치도',
  '52': '전북특별자치도',
}

/** 행정구역 코드(2자리 또는 5자리) → 시도 이름 */
export function sidoOf(region: string | undefined): string | undefined {
  return region ? SIDO[region.slice(0, 2)] : undefined
}

export const LIST_SORTS = {
  next: '다음 판단 시점이 가까운 순',
  recent: '최근 평가 순',
  heavy: '판정이 무거운 순',
} as const
export type ListSort = keyof typeof LIST_SORTS

export const KINDS = { program: '사업만', budget: '재정 문서만' } as const
export type ListKind = keyof typeof KINDS

export const ProgramsSearchSchema = z.object({
  // 주소의 ?region=41 은 숫자로 읽힌다
  region: z.coerce
    .string()
    .regex(/^\d{2}$/)
    .optional()
    .catch(undefined),
  ministry: z.coerce.string().regex(ORG_ID).optional().catch(undefined),
  /** 기관 하나 (기관 페이지의 ‘더 보기’) */
  org: z.coerce.string().regex(ORG_ID).optional().catch(undefined),
  field: z.string().min(1).optional().catch(undefined),
  verdict: z.enum(AXIS_STATUSES).optional().catch(undefined),
  kind: z
    .enum(Object.keys(KINDS) as [ListKind, ...Array<ListKind>])
    .optional()
    .catch(undefined),
  sort: z
    .enum(Object.keys(LIST_SORTS) as [ListSort, ...Array<ListSort>])
    .optional()
    .catch(undefined),
  page: PageSchema,
})
export type ProgramsSearch = z.infer<typeof ProgramsSearchSchema>

/** 목록 한 줄: 게시 요약에 평가 대상의 기관·지역·부처·분야를 붙인 것 */
export interface ListedReport {
  summary: ReportSummary
  kind: ListKind
  org: string
  orgName: string
  /** 기관의 행정구역 코드 */
  region?: string
  /** 사업을 맡은 중앙행정기관: 사업 기관이 부처면 그 부처, 국고보조사업이면 중앙 사업의 부처 */
  ministries: ReadonlyArray<string>
  sector?: string
  /** 화면 표기 날짜(2026. 10. 27.) → 정렬용 2026-10-27 */
  asOfIso: string
  overall: AxisStatus
}

/** 무거운 판정이 앞: 개선 필요 → 지켜볼 점 → 판단 불가 → 순항 */
const WEIGHT: Record<AxisStatus, number> = {
  fix: 0,
  watch: 1,
  unknown: 2,
  'on-track': 3,
}

/** ‘2026. 10. 27.’ → ‘2026-10-27’. 모르는 꼴이면 그대로 */
export function isoOf(dotted: string): string {
  const m = dotted.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/)
  return m
    ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    : dotted
}

/** 오늘 이후 가장 가까운 판단 시점(날짜를 아는 것만) */
export function nextDateOf(
  s: ReportSummary,
  today: string,
): ReportSummary['nextDates'][number] | undefined {
  return s.nextDates
    .filter((d) => d.date && d.date >= today.slice(0, d.date.length))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0]
}

export function listedReport(
  summary: ReportSummary,
  where: Omit<ListedReport, 'summary' | 'asOfIso' | 'overall'>,
): ListedReport {
  return {
    ...where,
    summary,
    asOfIso: isoOf(summary.asOf),
    overall: summarize(summary).overall,
  }
}

export function filterReports(
  rows: ReadonlyArray<ListedReport>,
  search: ProgramsSearch,
  today: string,
): Array<ListedReport> {
  const kept = rows.filter(
    (r) =>
      (!search.region || r.region?.startsWith(search.region)) &&
      (!search.ministry || r.ministries.includes(search.ministry)) &&
      (!search.org || r.org === search.org) &&
      (!search.field || r.sector === search.field) &&
      (!search.verdict || r.overall === search.verdict) &&
      (!search.kind || r.kind === search.kind),
  )
  const sort = search.sort ?? 'next'
  const nextKey = (r: ListedReport) =>
    nextDateOf(r.summary, today)?.date ?? '9999'
  return [...kept].sort((a, b) =>
    sort === 'recent'
      ? b.asOfIso.localeCompare(a.asOfIso)
      : sort === 'heavy'
        ? WEIGHT[a.overall] - WEIGHT[b.overall] ||
          b.asOfIso.localeCompare(a.asOfIso)
        : nextKey(a).localeCompare(nextKey(b)) ||
          WEIGHT[a.overall] - WEIGHT[b.overall],
  )
}

export type Distribution = Record<AxisStatus, number>

/** 종합 판정 분포. 분모와 함께 보여야 하며 성적이 아니다 */
export function distribution(rows: ReadonlyArray<ListedReport>): Distribution {
  const out: Distribution = { fix: 0, watch: 0, 'on-track': 0, unknown: 0 }
  for (const r of rows) out[r.overall]++
  return out
}

/** 지자체 기관 종류: 같은 시도 안에서 광역 → 기초 → 의회·교육청 순 */
const TYPE_ORDER: Record<Org['type'], number> = {
  중앙행정기관: 0,
  헌법기관: 0,
  독립기관: 0,
  광역자치단체: 1,
  기초자치단체: 2,
  지방의회: 3,
  교육청: 4,
  공공기관: 5,
}

export function byOrgOrder<T extends Pick<Org, 'type' | 'name'>>(
  a: T,
  b: T,
): number {
  return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name)
}

/** ‘1조 2,345억 원’, ‘340억 원’, ‘8천만 원’ */
export function won(v: number): string {
  if (v < 1e8) return `${Math.round(v / 1e7)}천만 원`
  const eok = Math.round(v / 1e8)
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000)
    const rest = eok % 10000
    return rest ? `${jo}조 ${rest.toLocaleString('ko-KR')}억 원` : `${jo}조 원`
  }
  return `${eok.toLocaleString('ko-KR')}억 원`
}
