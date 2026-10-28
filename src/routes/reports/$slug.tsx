import { createFileRoute, notFound } from '@tanstack/react-router'
import { fetchReportDoc } from '#/features/reports/server/report-docs.functions'
import { ReportPage } from '#/features/reports/view/report-page'

export const Route = createFileRoute('/reports/$slug')({
  // 문서 파싱은 서버 함수 안에서만 한다. 브라우저는 결과 JSON을 받아 그리기만 한다
  loader: async ({ params }) => {
    const doc = await fetchReportDoc({ data: { slug: params.slug } })
    if (!doc) throw notFound()
    return doc
  },
  head: ({ loaderData: a }) => {
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
  return <ReportPage doc={Route.useLoaderData()} />
}
