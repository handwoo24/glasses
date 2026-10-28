import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { fetchReportDoc } from '#/features/reports/server/report-docs.functions'
import { reportPath } from '#/features/reports/summary'
import { ReportPage } from '#/features/reports/view/report-page'
import {
  ReportNotFound,
  reportHead,
} from '#/features/reports/view/report-route'

/** 옛 주소. 리포트 주소는 평가 대상 경로로 바뀌었으므로 그리로 넘긴다 */
export const Route = createFileRoute('/reports/$slug')({
  loader: async ({ params }) => {
    const doc = await fetchReportDoc({ data: { slug: params.slug } })
    if (!doc) throw notFound()
    if (doc.subject)
      throw redirect({ href: reportPath(doc.subject), statusCode: 301 })
    return doc
  },
  head: ({ loaderData }) => reportHead(loaderData),
  component: ReportRoute,
  notFoundComponent: ReportNotFound,
})

function ReportRoute() {
  return <ReportPage doc={Route.useLoaderData()} />
}
