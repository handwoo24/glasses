import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { toSummary } from '../report-doc'
import type { ReportDoc, ReportSummary } from '../report-doc'
import { getReportDoc, publishedDocs } from './report-docs.server'

/** 홈 카드용 리포트 요약 목록 */
export const listReportSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<ReportSummary>> =>
    (await publishedDocs()).map(toSummary),
)

/** 리포트 한 건. 없으면 null */
export const fetchReportDoc = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }))
  .handler(
    async ({ data }): Promise<ReportDoc | null> =>
      (await getReportDoc(data.slug)) ?? null,
  )
