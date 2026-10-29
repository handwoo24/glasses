// 게시 리포트 줄(기관 페이지 · 사업 목록): 사업 이름과 기관 · 7개 축 요약 · 종합 판정 · 다음 판단 시점 · 자료 기준
import { AxisSummary } from '#/features/reports/view/axis-summary'
import { StatusBadge } from '#/features/reports/view/parts'
import { ReportLink } from '#/features/reports/view/report-link'
import { nextDateOf } from '../list'
import type { ListedReport } from '../list'

interface ReportRowsProps {
  rows: ReadonlyArray<ListedReport>
  today: string
  /** 기관 이름을 줄 머리에 적는다 (여러 기관이 섞인 목록) */
  showOrg?: boolean
}

export function ReportRows({ rows, today, showOrg }: ReportRowsProps) {
  return (
    <>
      <div className="prog-head" aria-hidden="true">
        <span>사업 · 재정 문서</span>
        <span>7개 축</span>
        <span>종합 판정</span>
        <span>다음 판단 시점</span>
        <span>자료 기준</span>
      </div>
      <ol className="prog-rows">
        {rows.map((r) => {
          const next = nextDateOf(r.summary, today)
          const kicker = [
            showOrg && r.orgName,
            r.kind === 'budget' ? '재정 문서' : r.sector,
          ].filter(Boolean)
          return (
            <li key={r.summary.slug}>
              <ReportLink
                subject={r.summary.subject}
                slug={r.summary.slug}
                className="prog-row"
              >
                <span className="name">
                  {kicker.length > 0 && (
                    <span className="kicker">{kicker.join(' · ')}</span>
                  )}
                  <h3>{r.summary.title}</h3>
                </span>
                <AxisSummary axes={r.summary.axes} mode="list" />
                <span>
                  <StatusBadge status={r.overall} overall />
                </span>
                <span className="meta">
                  {next ? (
                    <>
                      <b>{next.when}</b> {next.what}
                    </>
                  ) : (
                    '정해진 날 없음'
                  )}
                </span>
                <span className="as-of">{r.summary.asOf}</span>
              </ReportLink>
            </li>
          )
        })}
      </ol>
    </>
  )
}
