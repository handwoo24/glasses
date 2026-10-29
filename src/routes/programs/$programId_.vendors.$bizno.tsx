import { createFileRoute, notFound } from '@tanstack/react-router'
import { VENDOR_SUBJECT_PATH } from '#/pipeline/schemas'
import { fetchVendorReport } from '#/features/vendors/server/vendor-docs.functions'
import { VendorReportPage } from '#/features/vendors/view/vendor-page'
import { ReportNotFound } from '#/features/reports/view/report-route'

/** 업체 리포트: 주소는 업체 평가 대상 경로 programs/{기관코드}.{사업}/vendors/{사업자등록번호} */
export const Route = createFileRoute('/programs/$programId_/vendors/$bizno')({
  loader: async ({ params }) => {
    const subject = `programs/${params.programId}/vendors/${params.bizno}`
    if (!VENDOR_SUBJECT_PATH.test(subject)) throw notFound()
    const doc = await fetchVendorReport({ data: { subject } })
    if (!doc) throw notFound()
    return doc
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} · ${loaderData.project} | glasses` },
          { name: 'description', content: loaderData.description },
        ]
      : [],
  }),
  component: VendorReport,
  notFoundComponent: ReportNotFound,
})

function VendorReport() {
  return <VendorReportPage doc={Route.useLoaderData()} />
}
