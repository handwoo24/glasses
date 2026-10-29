import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ORG_ID } from '#/pipeline/schemas'
import type { OrgWorklist, VendorPage } from './worklist.server'
import {
  readOrgWorklist,
  readVendorList,
  readVendorPage,
} from './worklist.server'

/** 기관 하나의 사업 목록과 작업 단계. 레지스트리에 없는 기관이면 null */
export const fetchOrgWorklist = createServerFn({ method: 'GET' })
  .validator(z.object({ org: z.string().regex(ORG_ID) }))
  .handler(async ({ data }): Promise<OrgWorklist | null> =>
    readOrgWorklist(data.org),
  )

/** 업체 페이지: 사업자등록번호 하나가 평가 대상 사업에서 맡은 일. 업체 카드가 없으면 null */
export const fetchVendorPage = createServerFn({ method: 'GET' })
  .validator(z.object({ bizno: z.string().regex(/^\d{10}$/) }))
  .handler(async ({ data }): Promise<VendorPage | null> =>
    readVendorPage(data.bizno),
  )

/** 용역 탭: 평가 대상 사업에 참여한 업체 전체 */
export const fetchVendorList = createServerFn({ method: 'GET' }).handler(
  async () => readVendorList(),
)
