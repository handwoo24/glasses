import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { homeQuery } from '#/features/directory/queries'
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
  // 오늘은 로더에서 한 번 정한다. 서버가 그린 화면과 브라우저가 같은 ‘다음 판단’을 쓴다
  loader: async ({ context, deps }) => {
    await context.queryClient.query(homeQuery(deps.sido, deps.ministry))
    return { today: new Date().toLocaleDateString('sv-SE') }
  },
  component: Home,
})

function Home() {
  const { sido, ministry } = Route.useLoaderDeps()
  const { data } = useSuspenseQuery(homeQuery(sido, ministry))
  const { today } = Route.useLoaderData()
  const { view } = Route.useSearch()
  return <HomePage data={data} view={view ?? 'regions'} today={today} />
}
