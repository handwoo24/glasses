import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { fetchDirectory } from '#/features/directory/server/directory.functions'
import { OrgsPage } from '#/features/directory/view/orgs-page'

/** 기관 고르기: /orgs?view=ministries|regions */
export const Route = createFileRoute('/orgs/')({
  validateSearch: z.object({
    view: z.enum(['ministries', 'regions']).optional().catch(undefined),
  }),
  loader: () => fetchDirectory(),
  head: () => ({
    meta: [
      { title: '기관 · glasses' },
      {
        name: 'description',
        content: '중앙 부처와 지자체별 glasses 평가 현황과 평가 대상 사업',
      },
    ],
  }),
  component: Orgs,
})

function Orgs() {
  const { orgs } = Route.useLoaderData()
  const { view } = Route.useSearch()
  return <OrgsPage orgs={orgs} view={view ?? 'regions'} />
}
