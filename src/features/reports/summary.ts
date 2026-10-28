// 게시 요약: 홈·목록이 리포트 원문을 파싱하지 않고 쓰는 것. 게시할 때(published/{주소}) 함께 저장한다.
import { z } from 'zod'
import { AXIS_IDS, AXIS_STATUSES, EVIDENCE_LEVELS } from './axes'
import type { ReportDoc } from './report-doc'

const AxisJudgeSchema = z.strictObject({
  status: z.enum(AXIS_STATUSES),
  evidence: z.enum(EVIDENCE_LEVELS),
})

export const ReportSummarySchema = z.strictObject({
  slug: z.string().min(1),
  /** 평가 대상 경로. 화면 주소가 된다 */
  subject: z.string().min(1).optional(),
  project: z.string().min(1),
  title: z.string().min(1),
  verdict: z.string().min(1),
  /** 화면 표기(2026. 10. 27.) */
  asOf: z.string().min(1),
  nextDates: z.array(
    z.strictObject({
      when: z.string().min(1),
      what: z.string().min(1),
      date: z.string().optional(),
    }),
  ),
  axes: z.record(z.enum(AXIS_IDS), AxisJudgeSchema),
})

export type ReportSummary = z.infer<typeof ReportSummarySchema>

export function toSummary(doc: ReportDoc): ReportSummary {
  const axes = Object.fromEntries(
    AXIS_IDS.map((id) => [
      id,
      { status: doc.axes[id].status, evidence: doc.axes[id].evidence },
    ]),
  ) as ReportSummary['axes']
  return {
    slug: doc.slug,
    ...(doc.subject ? { subject: doc.subject } : {}),
    project: doc.project,
    title: doc.title,
    verdict: doc.verdict,
    asOf: doc.asOf,
    nextDates: doc.nextDates.map((d) => ({ ...d })),
    axes,
  }
}

/** 리포트 화면 주소: 평가 대상 경로 그대로(/programs/… · /orgs/…/budgets/…) */
export function reportPath(subject: string): string {
  return `/${subject}`
}
