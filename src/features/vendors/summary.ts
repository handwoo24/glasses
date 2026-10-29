// 업체 리포트 게시 요약: 목록·사업 리포트가 업체 리포트 원문을 파싱하지 않고 쓰는 것. 게시할 때 함께 저장한다.
import { z } from 'zod'
import { AXIS_STATUSES, EVIDENCE_LEVELS } from '../reports/axes'
import { VENDOR_AXIS_IDS } from './axes'
import type { VendorReportDoc } from './vendor-doc'

export const VendorSummarySchema = z.strictObject({
  slug: z.string().min(1),
  subject: z.string().min(1).optional(),
  program: z.string().min(1),
  project: z.string().min(1),
  vendor: z.string().min(1),
  role: z.string().min(1),
  /** 화면 표기(2026. 10. 29.) */
  asOf: z.string().min(1),
  nextDates: z.array(
    z.strictObject({
      when: z.string().min(1),
      what: z.string().min(1),
      date: z.string().optional(),
    }),
  ),
  axes: z.record(
    z.enum(VENDOR_AXIS_IDS),
    z.strictObject({
      status: z.enum(AXIS_STATUSES),
      evidence: z.enum(EVIDENCE_LEVELS),
    }),
  ),
})

export type VendorSummary = z.infer<typeof VendorSummarySchema>

export function toVendorSummary(doc: VendorReportDoc): VendorSummary {
  const axes = Object.fromEntries(
    VENDOR_AXIS_IDS.map((id) => [
      id,
      { status: doc.axes[id].status, evidence: doc.axes[id].evidence },
    ]),
  ) as VendorSummary['axes']
  return {
    slug: doc.slug,
    ...(doc.subject ? { subject: doc.subject } : {}),
    program: doc.program,
    project: doc.project,
    vendor: doc.vendor,
    role: doc.role,
    asOf: doc.asOf,
    nextDates: doc.nextDates.map((d) => ({ ...d })),
    axes,
  }
}
