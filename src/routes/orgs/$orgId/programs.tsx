import { createFileRoute, notFound } from '@tanstack/react-router'
import { ORG_ID } from '#/pipeline/schemas'
import { WorklistSearchSchema } from '#/features/worklist/list'
import { fetchOrgWorklist } from '#/features/worklist/server/worklist.functions'
import { WorklistPage } from '#/features/worklist/view/worklist-page'

/** 기관별 사업 목록 · 작업 현황: /orgs/{기관코드}/programs?dept=&stage=&sort= */
export const Route = createFileRoute('/orgs/$orgId/programs')({
  validateSearch: WorklistSearchSchema,
  loader: async ({ params }) => {
    // 형식이 틀린 주소와 레지스트리에 없는 기관만 404로. 읽기 오류는 그대로 올린다
    if (!ORG_ID.test(params.orgId)) throw notFound()
    const data = await fetchOrgWorklist({ data: { org: params.orgId } })
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.org.name} 사업 · glasses` },
          {
            name: 'description',
            content: `${loaderData.org.name}의 평가 대상 사업 ${loaderData.items.length}개와 리포트 작업 현황`,
          },
        ]
      : [],
  }),
  component: OrgPrograms,
  notFoundComponent: OrgNotFound,
})

function OrgPrograms() {
  return (
    <WorklistPage data={Route.useLoaderData()} search={Route.useSearch()} />
  )
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
