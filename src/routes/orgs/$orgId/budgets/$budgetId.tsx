import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { SUBJECT_PATH } from '#/pipeline/schemas'
import { reportBySubjectQuery } from '#/features/reports/queries'
import { ReportPage } from '#/features/reports/view/report-page'
import {
  ReportNotFound,
  headFields,
  reportHead,
} from '#/features/reports/view/report-route'

/** 재정 문서 리포트: 주소는 평가 대상 경로 orgs/{기관코드}/budgets/{연도-구분} */
export const Route = createFileRoute('/orgs/$orgId/budgets/$budgetId')({
  loader: async ({ context, params }) => {
    const subject = `orgs/${params.orgId}/budgets/${params.budgetId}`
    // 형식이 틀린 주소만 404로. 읽기 오류는 그대로 올린다
    if (!SUBJECT_PATH.test(subject)) throw notFound()
    const doc = await context.queryClient.query(reportBySubjectQuery(subject))
    return headFields(doc)
  },
  head: ({ loaderData }) => reportHead(loaderData),
  component: BudgetReport,
  notFoundComponent: ReportNotFound,
})

function BudgetReport() {
  const { orgId, budgetId } = Route.useParams()
  const { data } = useSuspenseQuery(
    reportBySubjectQuery(`orgs/${orgId}/budgets/${budgetId}`),
  )
  return <ReportPage doc={data} />
}
