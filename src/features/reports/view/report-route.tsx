// 리포트 라우트(/programs/… · /orgs/…/budgets/… · 업체 리포트)가 같이 쓰는 것: 머리 메타, 찾을 수 없음 화면.
import type { ReportDoc } from '../report-doc'

export type HeadFields = Pick<ReportDoc, 'title' | 'project' | 'description'>

/** 로더가 돌려줄 머리 메타 재료. 원문 전체를 loaderData에 싣지 않으려고 세 필드만 */
export function headFields(doc: HeadFields): HeadFields {
  return {
    title: doc.title,
    project: doc.project,
    description: doc.description,
  }
}

export function reportHead(doc: HeadFields | undefined) {
  return {
    meta: doc
      ? [
          { title: `${doc.title} · ${doc.project} | glasses` },
          { name: 'description', content: doc.description },
        ]
      : [],
  }
}

export function ReportNotFound() {
  return (
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
  )
}
