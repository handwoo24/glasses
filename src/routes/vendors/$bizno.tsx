import { createFileRoute, notFound } from '@tanstack/react-router'
import { fetchVendorPage } from '#/features/worklist/server/worklist.functions'
import { VendorProfilePage } from '#/features/vendors/view/vendor-profile'
import { ReportNotFound } from '#/features/reports/view/report-route'

/** 업체 페이지: /vendors/{사업자등록번호}. 평가 대상 사업에서 맡은 일과 사업별 업체 리포트 */
export const Route = createFileRoute('/vendors/$bizno')({
  loader: async ({ params }) => {
    if (!/^\d{10}$/.test(params.bizno)) throw notFound()
    const data = await fetchVendorPage({ data: { bizno: params.bizno } })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.registry?.name ?? loaderData.bizno} · 업체 · glasses`,
          },
          {
            name: 'description',
            content: `평가 대상 사업 ${loaderData.engagements.length}개에서 맡은 일과 사업별 업체 리포트`,
          },
        ]
      : [],
  }),
  component: VendorProfile,
  notFoundComponent: ReportNotFound,
})

function VendorProfile() {
  return <VendorProfilePage data={Route.useLoaderData()} />
}
