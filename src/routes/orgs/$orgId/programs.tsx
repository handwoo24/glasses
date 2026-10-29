import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ORG_ID } from '#/pipeline/schemas'
import { WorklistSearchSchema } from '#/features/worklist/list'
import { orgWorklistQuery } from '#/features/worklist/queries'
import { WorklistPage } from '#/features/worklist/view/worklist-page'

/** 기관별 사업 목록 · 작업 현황: /orgs/{기관코드}/programs?dept=&stage=&sort= */
export const Route = createFileRoute('/orgs/$orgId/programs')({
  validateSearch: WorklistSearchSchema,
  loader: async ({ context, params }) => {
    // 형식이 틀린 주소와 레지스트리에 없는 기관만 404로. 읽기 오류는 그대로 올린다
    if (!ORG_ID.test(params.orgId)) throw notFound()
    const data = await context.queryClient.query(orgWorklistQuery(params.orgId))
    // head에 쓸 것만 돌려준다
    return { name: data.org.name, items: data.items.length }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} 사업 · glasses` },
          {
            name: 'description',
            content: `${loaderData.name}의 평가 대상 사업 ${loaderData.items}개와 리포트 작업 현황`,
          },
        ]
      : [],
  }),
  component: OrgPrograms,
  notFoundComponent: OrgNotFound,
})

function OrgPrograms() {
  const { orgId } = Route.useParams()
  const { data } = useSuspenseQuery(orgWorklistQuery(orgId))
  return <WorklistPage data={data} search={Route.useSearch()} />
}

function OrgNotFound() {
  return (
    <div className="page">
      <div className="doc">
        <header className="doc-head">
          <h1>기관을 찾을 수 없습니다</h1>
          <p className="lede">
            기관코드가 틀렸거나 아직 사업 목록을 만들지 않은 기관입니다.
          </p>
        </header>
      </div>
    </div>
  )
}
