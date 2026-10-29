import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { vendorPageQuery } from '#/features/worklist/queries'
import { VendorProfilePage } from '#/features/vendors/view/vendor-profile'
import { ReportNotFound } from '#/features/reports/view/report-route'

/** 업체 페이지: /vendors/{사업자등록번호}. 평가 대상 사업에서 맡은 일과 사업별 업체 리포트 */
export const Route = createFileRoute('/vendors/$bizno')({
  loader: async ({ context, params }) => {
    if (!/^\d{10}$/.test(params.bizno)) throw notFound()
    const data = await context.queryClient.query(vendorPageQuery(params.bizno))
    // head에 쓸 것만 돌려준다
    return {
      name: data.registry?.name ?? data.bizno,
      engagements: data.engagements.length,
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} · 업체 · glasses` },
          {
            name: 'description',
            content: `평가 대상 사업 ${loaderData.engagements}개에서 맡은 일과 사업별 업체 리포트`,
          },
        ]
      : [],
  }),
  component: VendorProfile,
  notFoundComponent: ReportNotFound,
})

function VendorProfile() {
  const { bizno } = Route.useParams()
  return (
    <VendorProfilePage data={useSuspenseQuery(vendorPageQuery(bizno)).data} />
  )
}
