// 리포트 라우트(/programs/… · /orgs/…/budgets/…)가 같이 쓰는 것: 머리 메타, 찾을 수 없음 화면.
import type { ReportDoc } from '../report-doc'

export function reportHead(doc: ReportDoc | undefined) {
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
