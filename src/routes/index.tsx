import { createFileRoute } from '@tanstack/react-router'
import { listReportSummaries } from '#/features/reports/server/report-docs.functions'
import { AXES_VERSION } from '#/features/reports/axes'
import { summarize } from '#/features/reports/assessment'
import { AxisSummary } from '#/features/reports/view/axis-summary'
import { ReportLink } from '#/features/reports/view/report-link'
import { DDay, StatusBadge } from '#/features/reports/view/parts'

export const Route = createFileRoute('/')({
  // 오늘은 로더에서 한 번 정한다. 서버가 그린 화면과 브라우저가 같은 목록을 쓴다
  loader: async () => ({
    reports: await listReportSummaries(),
    today: new Date().toLocaleDateString('sv-SE'),
  }),
  component: Home,
})

/** 홈에 보이는 판단 시점 묶음 수 */
const UPCOMING_LIMIT = 6

type Summary = Awaited<ReturnType<typeof listReportSummaries>>[number]

/** 지나지 않은 판단 시점을 날짜순으로, 같은 라벨끼리 묶는다. 날짜를 모르는 것은 뒤로 */
function upcomingDays(reports: ReadonlyArray<Summary>, today: string) {
  const items = reports
    .flatMap((r) => r.nextDates.map((d) => ({ ...d, r })))
    .filter((d) => !d.date || d.date >= today.slice(0, d.date.length))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const groups = new Map<string, typeof items>()
  for (const it of items)
    groups.set(it.when, [...(groups.get(it.when) ?? []), it])
  return [...groups].slice(0, UPCOMING_LIMIT)
}

function Home() {
  const { reports, today } = Route.useLoaderData()
  const upcoming = upcomingDays(reports, today)
  return (
    <div className="page">
      <div className="home-page">
        <section className="home-hero">
          <h1>
            정부와 지자체 사업을
            <br />
            공개 자료로 평가합니다
          </h1>
          <p>
            부처와 지자체가 공개한 원문으로 사업과 예산을 정리하고 목표·진척·
            성과·비용·집행·지속성·투명성의 7개 축으로 평가합니다. 모든 숫자에
            원문 출처가 붙어 있고, 새 자료가 나오면 평가를 고칩니다. 평가 체계 v
            {AXES_VERSION}(초안)을 따릅니다.
          </p>
        </section>

        {upcoming.length > 0 && (
          <section className="home-sec" aria-labelledby="t-upcoming">
            <div className="home-sh">
              <h2 id="t-upcoming">다가오는 판단 시점</h2>
              <span>판정을 바꿀 수 있는 자료가 나오는 날</span>
            </div>
            <ol className="days">
              {upcoming.map(([when, items]) => (
                <li key={when}>
                  <span className="when">
                    {when} <DDay date={items[0].date} />
                  </span>
                  <span className="day-items">
                    {items.map(({ what, r }, i) => (
                      <ReportLink
                        key={`${r.slug}-${i}`}
                        subject={r.subject}
                        slug={r.slug}
                        className="day-item"
                      >
                        <span className="txt">
                          <b>{what}</b>
                          <span className="sub">
                            <span>{r.title}</span>
                            <AxisSummary axes={r.axes} mode="count" />
                          </span>
                        </span>
                        <StatusBadge status={summarize(r).overall} overall />
                      </ReportLink>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="home-sec" aria-labelledby="t-recent">
          <div className="home-sh">
            <h2 id="t-recent">평가한 사업</h2>
            <span>{reports.length}건</span>
          </div>
          <div className="report-cards">
            {reports.map((r) => {
              const { overall } = summarize(r)
              return (
                <ReportLink
                  key={r.slug}
                  subject={r.subject}
                  slug={r.slug}
                  className="report-card"
                >
                  <span className="top">
                    <StatusBadge status={overall} overall />
                  </span>
                  <span className="proj">{r.project}</span>
                  <h3>{r.title}</h3>
                  <AxisSummary axes={r.axes} />
                  <span className="s">{r.verdict}</span>
                  <span className="meta">{r.asOf} 기준</span>
                </ReportLink>
              )
            })}
          </div>
          <p className="cap">
            막대는 7개 축을 상태별로 센 것입니다. 진한 노랑은 개선 필요, 옅은
            노랑은 지켜볼 점, 남색은 순항, 회색은 판단 불가입니다.
          </p>
        </section>
      </div>
    </div>
  )
}
