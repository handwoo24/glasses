import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { ORG_ID } from '#/pipeline/schemas'
import type { Directory, OrgPage } from './directory.server'
import { readDirectory, readOrgPage } from './directory.server'

/** 기관 레지스트리 전체와 게시 리포트 목록 (기관 고르기 · 사업 목록) */
export const fetchDirectory = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Directory> => readDirectory(),
)

/** 기관 페이지. 레지스트리에 없는 기관이면 null */
export const fetchOrgPage = createServerFn({ method: 'GET' })
  .validator(z.object({ org: z.string().regex(ORG_ID) }))
  .handler(async ({ data }): Promise<OrgPage | null> => readOrgPage(data.org))
