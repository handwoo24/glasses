import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { reportBySlugQuery } from '#/features/reports/queries'
import { reportPath } from '#/features/reports/summary'
import { ReportPage } from '#/features/reports/view/report-page'
import {
  ReportNotFound,
  headFields,
  reportHead,
} from '#/features/reports/view/report-route'

/** 옛 주소. 리포트 주소는 평가 대상 경로로 바뀌었으므로 그리로 넘긴다 */
export const Route = createFileRoute('/reports/$slug')({
  loader: async ({ context, params }) => {
    const doc = await context.queryClient.query(reportBySlugQuery(params.slug))
    if (doc.subject)
      throw redirect({ href: reportPath(doc.subject), statusCode: 301 })
    return headFields(doc)
  },
  head: ({ loaderData }) => reportHead(loaderData),
  component: ReportRoute,
  notFoundComponent: ReportNotFound,
})

function ReportRoute() {
  const { slug } = Route.useParams()
  return <ReportPage doc={useSuspenseQuery(reportBySlugQuery(slug)).data} />
}
