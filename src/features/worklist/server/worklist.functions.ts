import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ORG_ID } from '#/pipeline/schemas'
import type { OrgWorklist } from './worklist.server'
import { readOrgWorklist } from './worklist.server'

/** 기관 하나의 사업 목록과 작업 단계. 레지스트리에 없는 기관이면 null */
export const fetchOrgWorklist = createServerFn({ method: 'GET' })
  .validator(z.object({ org: z.string().regex(ORG_ID) }))
  .handler(async ({ data }): Promise<OrgWorklist | null> =>
    readOrgWorklist(data.org),
  )
