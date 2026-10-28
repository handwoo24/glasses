import { createFileRoute, notFound } from '@tanstack/react-router'
import { SUBJECT_PATH } from '#/pipeline/schemas'
import { fetchReportBySubject } from '#/features/reports/server/report-docs.functions'
import { ReportPage } from '#/features/reports/view/report-page'
import {
  ReportNotFound,
  reportHead,
} from '#/features/reports/view/report-route'

/** 사업 리포트: 주소는 평가 대상 경로 programs/{기관코드}.{사업} */
export const Route = createFileRoute('/programs/$programId')({
  // 문서 파싱은 서버 함수 안에서만 한다. 브라우저는 결과 JSON을 받아 그리기만 한다
  loader: async ({ params }) => {
    const subject = `programs/${params.programId}`
    // 형식이 틀린 주소만 404로. 읽기 오류는 그대로 올린다
    if (!SUBJECT_PATH.test(subject)) throw notFound()
    const doc = await fetchReportBySubject({ data: { subject } })
    if (!doc) throw notFound()
    return doc
  },
  head: ({ loaderData }) => reportHead(loaderData),
  component: ProgramReport,
  notFoundComponent: ReportNotFound,
})

function ProgramReport() {
  return <ReportPage doc={Route.useLoaderData()} />
}
