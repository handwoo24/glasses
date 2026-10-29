// 홈·지역·기관 페이지가 함께 쓰는 게시 리포트 목록 한 줄과 정렬, 시도 이름, 금액 표기.
import { summarize } from '#/features/reports/assessment'
import type { AxisStatus } from '#/features/reports/axes'
import type { ReportSummary } from '#/features/reports/summary'
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

/** 게시 리포트의 평가 대상: 사업 또는 재정 문서 */
export type ListKind = 'program' | 'budget'

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

/** 판정이 무거운 순, 같으면 최근 평가 순 */
export function heavyFirst(
  rows: ReadonlyArray<ListedReport>,
): Array<ListedReport> {
  return [...rows].sort(
    (a, b) =>
      WEIGHT[a.overall] - WEIGHT[b.overall] ||
      b.asOfIso.localeCompare(a.asOfIso),
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
