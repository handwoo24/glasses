import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import {
  fetchMinistries,
  fetchRegion,
} from '#/features/directory/server/directory.functions'
import { MinistriesPage, RegionPage } from '#/features/directory/view/orgs-page'

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
  loader: async ({ deps }) =>
    deps.view === 'ministries'
      ? { kind: 'ministries' as const, ministries: await fetchMinistries() }
      : {
          kind: 'regions' as const,
          region: await fetchRegion({ data: { sido: deps.sido } }),
        },
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData?.kind === 'regions'
            ? `${loaderData.region.panel.name} · glasses`
            : '부처 · glasses',
      },
      {
        name: 'description',
        content: '중앙 부처와 지자체별 glasses 평가 현황과 평가 대상 사업',
      },
    ],
  }),
  component: Orgs,
})

function Orgs() {
  const data = Route.useLoaderData()
  return data.kind === 'ministries' ? (
    <MinistriesPage ministries={data.ministries} />
  ) : (
    <RegionPage data={data.region} />
  )
}
