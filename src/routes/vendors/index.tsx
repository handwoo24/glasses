import { createFileRoute } from '@tanstack/react-router'
import { VendorsSearchSchema } from '#/features/vendors/list'
import { VendorsPage } from '#/features/vendors/view/vendors-page'
import { fetchVendorList } from '#/features/worklist/server/worklist.functions'

/** 용역 탭: /vendors?region=&org=&verdict=&q=&sort=&page= */
export const Route = createFileRoute('/vendors/')({
  validateSearch: VendorsSearchSchema,
  loader: () => fetchVendorList(),
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
  const { items, orgs } = Route.useLoaderData()
  return <VendorsPage items={items} orgs={orgs} search={Route.useSearch()} />
}
