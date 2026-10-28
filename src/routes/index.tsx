import { Link, createFileRoute } from '@tanstack/react-router'
import { listReportSummaries } from '#/features/reports/server/report-docs.functions'
import {
  AXES_VERSION,
  AXIS_IDS,
  AXIS_INFO,
  STATUS_INFO,
} from '#/features/reports/axes'
import { STATUS_TONE, summarize } from '#/features/reports/assessment'
import { OverallEvidenceMark, StatusBadge } from '#/features/reports/view/parts'

export const Route = createFileRoute('/')({
  loader: () => listReportSummaries(),
  component: Home,
})

function Home() {
  const reportDocs = Route.useLoaderData()
  return (
    <div className="page">
      <div className="index">
        <h1>고양시 공공사업, 공개 자료로 봅니다</h1>
        <p className="intro">
          시와 시의회가 공개한 원문으로 사업 내용, 예산과 집행, 계약을 정리하고
          목표·진척·성과·비용·집행·지속성·투명성의 7개 축으로 평가했습니다. 모든
          숫자에 원문 링크가 붙어 있습니다. 평가는 시에 질의하기 전에 공개
          자료만으로 했고, 평가 체계 v{AXES_VERSION}(초안)을 따릅니다.
        </p>
        <div className="cards">
          {reportDocs.map((a) => {
            const { overall, evidence, statuses } = summarize(a)
            return (
              <Link
                key={a.slug}
                to="/reports/$slug"
                params={{ slug: a.slug }}
                className={`card ${STATUS_TONE[overall]}`}
              >
                <p className="proj">{a.project}</p>
                <h2>{a.title}</h2>
                <p>
                  <StatusBadge status={overall} overall />{' '}
                  <OverallEvidenceMark level={evidence} />
                </p>
                <div
                  className="axes-mini"
                  role="img"
                  aria-label={AXIS_IDS.map(
                    (x) =>
                      `${AXIS_INFO[x].label} ${STATUS_INFO[statuses[x]].label}`,
                  ).join(', ')}
                >
                  {AXIS_IDS.map((x) => (
                    <span
                      key={x}
                      className={`st ${STATUS_TONE[statuses[x]]}`}
                      title={`${AXIS_INFO[x].label}: ${STATUS_INFO[statuses[x]].label}`}
                    >
                      {AXIS_INFO[x].no}
                    </span>
                  ))}
                </div>
                <p className="s">{a.verdict}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
