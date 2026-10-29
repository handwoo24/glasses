import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ministriesQuery, regionQuery } from '#/features/directory/queries'
import { MinistriesPage, RegionPage } from '#/features/directory/view/orgs-page'

const MINISTRIES_TITLE = '부처 · glasses'

/** 지역 탭 /orgs?view=regions&sido=41 · 부처 탭 /orgs?view=ministries */
export const Route = createFileRoute('/orgs/')({
  validateSearch: z.object({
    view: z.enum(['ministries', 'regions']).optional().catch(undefined),
    // 주소의 ?sido=41 은 숫자로 읽힌다
    sido: z.coerce
      .string()
      .regex(/^\d{2}$/)
      .optional()
      .catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ view: search.view, sido: search.sido }),
  // head에 쓸 제목만 돌려준다
  loader: async ({ context: { queryClient }, deps }) => {
    if (deps.view === 'ministries') {
      await queryClient.query(ministriesQuery())
      return { title: MINISTRIES_TITLE }
    }
    const region = await queryClient.query(regionQuery(deps.sido))
    return { title: `${region.panel.name} · glasses` }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ?? MINISTRIES_TITLE },
      {
        name: 'description',
        content: '중앙 부처와 지자체별 glasses 평가 현황과 평가 대상 사업',
      },
    ],
  }),
  component: Orgs,
})

function Orgs() {
  const { view, sido } = Route.useLoaderDeps()
  return view === 'ministries' ? <Ministries /> : <Region sido={sido} />
}

function Ministries() {
  const { data } = useSuspenseQuery(ministriesQuery())
  return <MinistriesPage ministries={data} />
}

function Region({ sido }: { sido?: string }) {
  const { data } = useSuspenseQuery(regionQuery(sido))
  return <RegionPage data={data} />
}
