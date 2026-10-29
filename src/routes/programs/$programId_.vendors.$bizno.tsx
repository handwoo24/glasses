import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { VENDOR_SUBJECT_PATH } from '#/pipeline/schemas'
import { vendorReportQuery } from '#/features/vendors/queries'
import { VendorReportPage } from '#/features/vendors/view/vendor-page'
import {
  ReportNotFound,
  headFields,
  reportHead,
} from '#/features/reports/view/report-route'

/** 업체 리포트: 주소는 업체 평가 대상 경로 programs/{기관코드}.{사업}/vendors/{사업자등록번호} */
export const Route = createFileRoute('/programs/$programId_/vendors/$bizno')({
  loader: async ({ context, params }) => {
    const subject = `programs/${params.programId}/vendors/${params.bizno}`
    if (!VENDOR_SUBJECT_PATH.test(subject)) throw notFound()
    const doc = await context.queryClient.query(vendorReportQuery(subject))
    return headFields(doc)
  },
  head: ({ loaderData }) => reportHead(loaderData),
  component: VendorReport,
  notFoundComponent: ReportNotFound,
})

function VendorReport() {
  const { programId, bizno } = Route.useParams()
  const { data } = useSuspenseQuery(
    vendorReportQuery(`programs/${programId}/vendors/${bizno}`),
  )
  return <VendorReportPage doc={data} />
}
