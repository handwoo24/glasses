import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { fetchHome } from '#/features/directory/server/directory.functions'
import { HomePage } from '#/features/directory/view/home-page'
import { ORG_ID } from '#/pipeline/schemas'

/** 홈: /?view=ministries&sido=41&ministry=1613000 */
export const Route = createFileRoute('/')({
  validateSearch: z.object({
    view: z.enum(['ministries']).optional().catch(undefined),
    // 주소의 ?sido=41 은 숫자로 읽힌다
    sido: z.coerce
      .string()
      .regex(/^\d{2}$/)
      .optional()
      .catch(undefined),
    ministry: z.coerce.string().regex(ORG_ID).optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({
    sido: search.sido,
    ministry: search.ministry,
  }),
  // 오늘은 로더에서 한 번 정한다. 서버가 그린 화면과 브라우저가 같은 목록을 쓴다
  loader: async ({ deps }) => {
    const today = new Date().toLocaleDateString('sv-SE')
    return {
      data: await fetchHome({ data: { ...deps, today } }),
      today,
    }
  },
  component: Home,
})

function Home() {
  const { data, today } = Route.useLoaderData()
  const { view } = Route.useSearch()
  return <HomePage data={data} view={view ?? 'regions'} today={today} />
}
