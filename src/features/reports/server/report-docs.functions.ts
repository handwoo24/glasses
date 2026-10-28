import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { SUBJECT_PATH } from '#/pipeline/schemas'
import type { ReportDoc } from '../report-doc'
import type { ReportSummary } from '../summary'
import {
  getReportBySubject,
  getReportDoc,
  publishedSummaries,
} from './report-docs.server'

/** 홈·목록용 리포트 요약 */
export const listReportSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<ReportSummary>> => [...(await publishedSummaries())],
)

/** 옛 주소(/reports/{slug})의 리포트. 없으면 null */
export const fetchReportDoc = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }))
  .handler(
    async ({ data }): Promise<ReportDoc | null> =>
      (await getReportDoc(data.slug)) ?? null,
  )

/** 평가 대상 경로로 리포트 한 건. 없으면 null */
export const fetchReportBySubject = createServerFn({ method: 'GET' })
  .validator(z.object({ subject: z.string().regex(SUBJECT_PATH) }))
  .handler(
    async ({ data }): Promise<ReportDoc | null> =>
      (await getReportBySubject(data.subject)) ?? null,
  )
