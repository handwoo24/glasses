import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { VendorsSearchSchema } from '#/features/vendors/list'
import { VendorsPage } from '#/features/vendors/view/vendors-page'
import { vendorListQuery } from '#/features/worklist/queries'

/** 용역 탭: /vendors?by=&home=&region=&q=&page= */
export const Route = createFileRoute('/vendors/')({
  validateSearch: VendorsSearchSchema,
  // 쿼리 데이터는 반환하지 않는다. 반환하면 loaderData와 쿼리 캐시에 두 번 실려 간다
  loader: async ({ context }) => {
    await context.queryClient.query(vendorListQuery())
  },
  head: () => ({
    meta: [
      { title: '용역업체 · glasses' },
      {
        name: 'description',
        content: '평가한 공공사업에 참여한 용역업체와 사업별 업체 리포트',
      },
    ],
  }),
  component: Vendors,
})

function Vendors() {
  const { items } = useSuspenseQuery(vendorListQuery()).data
  return <VendorsPage items={items} search={Route.useSearch()} />
}
