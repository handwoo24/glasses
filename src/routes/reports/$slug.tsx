import { createFileRoute, notFound } from '@tanstack/react-router'
import { getReportDoc } from '#/content/report-docs'
import { ReportPage } from '#/features/reports/view/report-page'

export const Route = createFileRoute('/reports/$slug')({
  loader: ({ params }) => {
    if (!getReportDoc(params.slug)) throw notFound()
    return { slug: params.slug }
  },
  head: ({ loaderData }) => {
    const a = loaderData && getReportDoc(loaderData.slug)
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
  // 리포트에는 렌더링된 본문 조각이 있어 로더 데이터로 직렬화하지 않고 모듈에서 꺼낸다
  const doc = getReportDoc(slug)
  if (!doc) throw notFound()
  return <ReportPage doc={doc} />
}
