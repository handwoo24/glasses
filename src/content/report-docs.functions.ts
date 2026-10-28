import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { toSummary } from '#/features/reports/report-doc'
import type { ReportDoc, ReportSummary } from '#/features/reports/report-doc'
import { getReportDoc, reportDocs } from './report-docs.server'

/** 홈 카드용 리포트 요약 목록 */
export const listReportSummaries = createServerFn({ method: 'GET' }).handler(
  (): Array<ReportSummary> => reportDocs.map(toSummary),
)

/** 리포트 한 건. 없으면 null */
export const fetchReportDoc = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }))
  .handler(({ data }): ReportDoc | null => getReportDoc(data.slug) ?? null)
