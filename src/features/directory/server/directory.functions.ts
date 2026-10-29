import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ORG_ID } from '#/pipeline/schemas'
import type { Directory, OrgPage } from './directory.server'
import { readDirectory, readOrgPage } from './directory.server'
import { readHome, readMinistries, readRegion } from './explorer.server'
import type { HomeData, MinistryTile, RegionData } from './explorer.server'

const SIDO_CODE = z.string().regex(/^\d{2}$/)

/** 기관 레지스트리 전체와 게시 리포트 목록 (기관 고르기 · 사업 목록) */
export const fetchDirectory = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Directory> => readDirectory(),
)

/** 기관 페이지. 레지스트리에 없는 기관이면 null */
export const fetchOrgPage = createServerFn({ method: 'GET' })
  .validator(z.object({ org: z.string().regex(ORG_ID) }))
  .handler(async ({ data }): Promise<OrgPage | null> => readOrgPage(data.org))

/** 홈: 시도 지도, 고른 시도·부처의 펼침 칸, 다가오는 판단 시점 */
export const fetchHome = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      sido: SIDO_CODE.optional(),
      ministry: z.string().regex(ORG_ID).optional(),
      today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }): Promise<HomeData> =>
    readHome(data.sido, data.ministry, data.today),
  )

/** 지역 탭: 시도 하나의 기관 */
export const fetchRegion = createServerFn({ method: 'GET' })
  .validator(z.object({ sido: SIDO_CODE.optional() }))
  .handler(async ({ data }): Promise<RegionData> => readRegion(data.sido))

/** 부처 탭: 중앙 기관 */
export const fetchMinistries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<MinistryTile>> => readMinistries(),
)
