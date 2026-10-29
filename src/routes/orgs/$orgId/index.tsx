import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ORG_ID } from '#/pipeline/schemas'
import { orgPageQuery } from '#/features/directory/queries'
import { OrgPageView } from '#/features/directory/view/org-page'

/** 기관 페이지: /orgs/{기관코드}. 지자체와 부처가 같은 주소, 부처는 국고보조 사업의 지역 시행을 함께 */
export const Route = createFileRoute('/orgs/$orgId/')({
  loader: async ({ context, params }) => {
    // 형식이 틀린 주소와 레지스트리에 없는 기관만 404로. 읽기 오류는 그대로 올린다
    if (!ORG_ID.test(params.orgId)) throw notFound()
    const data = await context.queryClient.query(orgPageQuery(params.orgId))
    // head에 쓸 것과 오늘만 돌려준다
    return {
      name: data.org.name,
      reports: data.reports.length,
      cards: data.org.cards,
      today: new Date().toLocaleDateString('sv-SE'),
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} · glasses` },
          {
            name: 'description',
            content: `${loaderData.name}의 glasses 평가 ${loaderData.reports}건과 평가 대상 사업 ${loaderData.cards}개`,
          },
        ]
      : [],
  }),
  component: Org,
  notFoundComponent: OrgNotFound,
})

function Org() {
  const { orgId } = Route.useParams()
  const { data } = useSuspenseQuery(orgPageQuery(orgId))
  return <OrgPageView data={data} today={Route.useLoaderData().today} />
}

function OrgNotFound() {
  return (
    <div className="page">
      <div className="dir">
        <header className="rp-hero">
          <h1>기관을 찾을 수 없습니다</h1>
          <p className="rp-lede">
            기관코드가 틀렸거나 아직 목록에 올리지 않은 기관입니다.
          </p>
        </header>
      </div>
    </div>
  )
}
