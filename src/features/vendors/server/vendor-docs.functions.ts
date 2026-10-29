import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { VENDOR_SUBJECT_PATH } from '#/pipeline/schemas'
import type { VendorReportDoc } from '../vendor-doc'
import { getVendorReport } from './vendor-docs.server'

/** 업체 평가 대상 경로로 업체 리포트 한 건. 없으면 null */
export const fetchVendorReport = createServerFn({ method: 'GET' })
  .validator(z.object({ subject: z.string().regex(VENDOR_SUBJECT_PATH) }))
  .handler(
    async ({ data }): Promise<VendorReportDoc | null> =>
      (await getVendorReport(data.subject)) ?? null,
  )
