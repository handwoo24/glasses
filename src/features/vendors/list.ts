// 용역 탭(/vendors): 평가 대상 사업에 참여한 업체 목록. 사업자등록번호 하나가 한 줄이고, 사업별로 맡은 일을 그 아래 적는다.
// 주소의 검색 조건(?by=&home=&region=&org=&verdict=&q=&sort=&page=)으로 정한다.
import { z } from 'zod'
import { AXIS_STATUSES } from '#/features/reports/axes'
import type { AxisStatus } from '#/features/reports/axes'
import { PageSchema } from '#/features/directory/paging'
import { sidoOfAddress } from '#/features/directory/regions'
import { ORG_ID } from '#/pipeline/schemas'
import type { Vendor } from '#/pipeline/schemas'
import type { WorkStage } from '#/features/worklist/stage'
import { VENDOR_AXIS_IDS, vendorOverallStatus } from './axes'
import type { VendorAxisStatuses } from './axes'
import type { VendorSummary } from './summary'

/** 게시한 업체 리포트의 종합 판정 */
export function vendorVerdict(summary: VendorSummary): AxisStatus {
  const statuses = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, summary.axes[a].status]),
  ) as VendorAxisStatuses
  const levels = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, summary.axes[a].evidence]),
  )
  return vendorOverallStatus(statuses, levels)
}

/** 업체가 사업 하나에서 맡은 일 */
export interface Engagement {
  program: string
  programName: string
  org: string
  orgName: string
  /** 사업 기관의 행정구역 코드 */
  region?: string
  role: string
  /** 이 사업 안 계약 합계(원) */
  amount: number
  contracts: number
  stage: WorkStage
  summary: VendorSummary | null
  verdict: AxisStatus | null
}

export interface VendorListItem {
  bizno: string
  name: string
  type?: Vendor['type']
  /** 본사 소재 시군구 (레지스트리) */
  home?: string
  /** 유효한 부정당 제재 수와 조회일 */
  sanctions?: Vendor['sanctions']
  engagements: Array<Engagement>
  amount: number
}

export const VENDOR_SORTS = {
  amount: '계약 금액 큰 순',
  programs: '참여 사업 많은 순',
  name: '이름 순',
} as const
export type VendorSort = keyof typeof VENDOR_SORTS

/** 용역 지도의 기준: 업체 본사 소재지(기본) 또는 업체가 일을 맡은 사업의 발주 기관 지역 */
export const VENDOR_MAP_BASES = ['home', 'org'] as const
export type VendorMapBasis = (typeof VENDOR_MAP_BASES)[number]

const SIDO_PARAM = z.coerce
  .string()
  .regex(/^\d{2}$/)
  .optional()
  .catch(undefined)

export const VendorsSearchSchema = z.object({
  by: z.enum(VENDOR_MAP_BASES).optional().catch(undefined),
  /** 업체 본사 소재지의 시도 */
  home: SIDO_PARAM,
  /** 사업 기관의 시도 (?region=41 은 숫자로 읽힌다) */
  region: SIDO_PARAM,
  org: z.coerce.string().regex(ORG_ID).optional().catch(undefined),
  verdict: z.enum(AXIS_STATUSES).optional().catch(undefined),
  /** 업체 이름이나 사업자등록번호 일부 */
  q: z.coerce.string().trim().min(1).max(40).optional().catch(undefined),
  sort: z
    .enum(Object.keys(VENDOR_SORTS) as [VendorSort, ...Array<VendorSort>])
    .optional()
    .catch(undefined),
  page: PageSchema,
})
export type VendorsSearch = z.infer<typeof VendorsSearchSchema>

const digits = (s: string) => s.replace(/\D/g, '')

export function filterVendors(
  items: ReadonlyArray<VendorListItem>,
  search: VendorsSearch,
): Array<VendorListItem> {
  const q = search.q?.toLowerCase()
  const kept = items.filter(
    (v) =>
      (!search.home || sidoOfAddress(v.home) === search.home) &&
      (!search.region ||
        v.engagements.some((e) => e.region?.startsWith(search.region ?? ''))) &&
      (!search.org || v.engagements.some((e) => e.org === search.org)) &&
      (!search.verdict ||
        v.engagements.some((e) => e.verdict === search.verdict)) &&
      (!q ||
        v.name.toLowerCase().includes(q) ||
        (digits(q).length >= 3 && v.bizno.includes(digits(q)))),
  )
  const sort = search.sort ?? 'amount'
  return [...kept].sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name, 'ko')
      : sort === 'programs'
        ? b.engagements.length - a.engagements.length || b.amount - a.amount
        : b.amount - a.amount,
  )
}

/** 시도마다 업체 수. 소재지 기준은 업체마다 한 번, 발주 기관 기준은 업체가 일한 시도마다 한 번 */
export function vendorSidoCounts(
  items: ReadonlyArray<VendorListItem>,
  by: VendorMapBasis,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of items) {
    const codes =
      by === 'home'
        ? [sidoOfAddress(v.home)]
        : v.engagements.map((e) => e.region?.slice(0, 2))
    for (const code of new Set(codes))
      if (code) out[code] = (out[code] ?? 0) + 1
  }
  return out
}
