import { createFileRoute, notFound } from '@tanstack/react-router'
import { getAssessment } from '#/content/assessments'
import { getReport } from '#/content/reports'
import { ReportPage } from '#/features/reports/view/report-page'

export const Route = createFileRoute('/reports/$slug')({
  loader: ({ params }) => {
    const report = getReport(params.slug)
    const assessment = getAssessment(params.slug)
    if (!report || !assessment) throw notFound()
    return { slug: params.slug }
  },
  head: ({ loaderData }) => {
    const a = loaderData && getAssessment(loaderData.slug)
    return {
      meta: a
        ? [
            { title: `${a.title} · ${a.project} | glasses` },
            { name: 'description', content: a.description },
          ]
        : [],
    }
  },
  component: ReportRoute,
  notFoundComponent: () => (
    <div className="page">
      <div className="doc">
        <header className="doc-head">
          <h1>리포트를 찾을 수 없습니다</h1>
          <p className="lede">
            주소가 바뀌었거나 아직 게시하지 않은 리포트입니다.
          </p>
        </header>
      </div>
    </div>
  ),
})

function ReportRoute() {
  const { slug } = Route.useLoaderData()
  // 평가에는 JSX 조각이 있어 로더 데이터로 직렬화하지 않고 모듈에서 꺼낸다
  const report = getReport(slug)
  const assessment = getAssessment(slug)
  if (!report || !assessment) throw notFound()
  return <ReportPage report={report} assessment={assessment} />
}
