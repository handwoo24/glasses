// 홈 / (캔버스 시안 ‘홈 C’): 시도 지도에서 고른 지역을 그 자리에서 펼친다. ‘부처’로 바꾸면 같은 칸에 중앙 기관을 띄운다.
// 아래에는 평가한 사업의 다가오는 판단 시점. 평가하지 않았다는 것은 문제가 없다는 뜻도, 있다는 뜻도 아니다.
import { Link } from '@tanstack/react-router'
import { ReportLink } from '#/features/reports/view/report-link'
import { DDay, StatusBadge } from '#/features/reports/view/parts'
import { nextDateOf } from '../list'
import type { ListedReport } from '../list'
import { toneOf } from '../regions'
import type {
  HomeData,
  MinistryPanel,
  MinistryTile,
  SidoPanel,
} from '../server/explorer.server'
import { MapKey, SidoMap, VerdictBar } from './sido-map'

export type HomeView = 'regions' | 'ministries'

interface HomePageProps {
  data: HomeData
  view: HomeView
  today: string
}

export function HomePage({ data, view, today }: HomePageProps) {
  const tones = Object.fromEntries(
    Object.entries(data.stats).map(([code, s]) => [code, toneOf(s)]),
  )
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
            지도에서 지역을 고르면 그 지역 기관과 평가한 사업이 옆에 펼쳐집니다.
            모든 숫자에는 원문 출처가 붙고, 새 자료가 나오면 평가를 고칩니다.
          </p>
        </section>

        <section className="explore" aria-label="지역·부처 둘러보기">
          <div className="explore-side">
            <nav className="seg" aria-label="보기">
              <Link
                to="/"
                search={{ sido: data.panel.code }}
                aria-current={view === 'regions' ? 'page' : undefined}
              >
                지역
              </Link>
              <Link
                to="/"
                search={{ view: 'ministries', ministry: data.ministry?.org.id }}
                aria-current={view === 'ministries' ? 'page' : undefined}
              >
                부처
              </Link>
            </nav>
            {view === 'regions' ? (
              <>
                <SidoMap
                  tones={tones}
                  selected={data.panel.code}
                  label="시도"
                  tile={({ code, short, className }) => (
                    <Link
                      to="/"
                      search={{ sido: code }}
                      className={className}
                      aria-current={
                        code === data.panel.code ? 'true' : undefined
                      }
                    >
                      {short}
                      <TileCount stat={data.stats[code]} />
                    </Link>
                  )}
                />
                <MapKey />
              </>
            ) : (
              <MinistryPicker
                ministries={data.ministries}
                selected={data.ministry?.org.id}
              />
            )}
          </div>
          {view === 'regions' ? (
            <SidoCard panel={data.panel} today={today} />
          ) : (
            data.ministry && <MinistryCard panel={data.ministry} />
          )}
        </section>

        {data.upcoming.length > 0 && (
          <section className="home-sec" aria-labelledby="t-upcoming">
            <div className="home-sh">
              <h2 id="t-upcoming">다가오는 판단 시점</h2>
              <span>판정을 바꿀 수 있는 자료가 나오는 날</span>
            </div>
            <ol className="days">
              {data.upcoming.map(({ when, date, what, report }, i) => (
                <li key={`${report.summary.slug}-${i}`}>
                  <span className="when">
                    {when} <DDay date={date} />
                  </span>
                  <span className="day-items">
                    <ReportLink
                      subject={report.summary.subject}
                      slug={report.summary.slug}
                      className="day-item"
                    >
                      <span className="txt">
                        <b>{what}</b>
                        <span className="sub">
                          <span>
                            {report.summary.title} · {report.orgName}
                          </span>
                        </span>
                      </span>
                      <StatusBadge status={report.overall} overall />
                    </ReportLink>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}

function TileCount({ stat }: { stat: HomeData['stats'][string] }) {
  if (!stat.orgs) return null
  return (
    <span className="s">
      {stat.published ? `평가 ${stat.published}` : `카드 ${stat.cards}`}
    </span>
  )
}

function SidoCard({ panel, today }: { panel: SidoPanel; today: string }) {
  const { stat } = panel
  return (
    <div className="explore-card">
      <div className="explore-head">
        <h2>{panel.name}</h2>
        <p>
          기관 {stat.orgs}곳 · 사업 카드 {stat.cards} · 평가 {stat.published}
        </p>
      </div>
      {panel.orgs.length > 0 ? (
        <table className="org-table">
          <thead>
            <tr>
              <th scope="col">기관</th>
              <th scope="col" className="num">
                카드
              </th>
              <th scope="col" className="num">
                평가
              </th>
              <th scope="col">판정 분포</th>
            </tr>
          </thead>
          <tbody>
            {panel.orgs.map((o) => (
              <tr key={o.id} className={o.cards ? undefined : 'quiet'}>
                <th scope="row">
                  <Link to="/orgs/$orgId" params={{ orgId: o.id }}>
                    {o.name}
                  </Link>
                </th>
                <td className="num">{o.cards}</td>
                <td className="num">{o.published}</td>
                <td>
                  {o.cards ? (
                    <VerdictBar verdicts={o.verdicts} className="thin" />
                  ) : (
                    <span className="k">목록 전</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="dir-none">
          이 시도의 기관은 아직 목록에 올리지 않았습니다.
        </p>
      )}
      {panel.top.length > 0 && (
        <div className="explore-top">
          <p className="k">{panel.name}에서 평가한 사업 · 판정이 무거운 순</p>
          <ReportList rows={panel.top} today={today} />
        </div>
      )}
      <Link
        to="/orgs"
        search={{ view: 'regions', sido: panel.code }}
        className="dir-go"
      >
        {panel.name} 기관 모두 보기 →
      </Link>
    </div>
  )
}

function ReportList({
  rows,
  today,
}: {
  rows: ReadonlyArray<ListedReport>
  today: string
}) {
  return (
    <ul className="explore-reports">
      {rows.map((r) => {
        const next = nextDateOf(r.summary, today)
        return (
          <li key={r.summary.slug}>
            <ReportLink subject={r.summary.subject} slug={r.summary.slug}>
              <span className="t">
                <b>{r.summary.title}</b>
                <span>
                  {r.orgName}
                  {next && ` · 다음 판단 ${next.when} ${next.what}`}
                </span>
              </span>
              <StatusBadge status={r.overall} overall />
            </ReportLink>
          </li>
        )
      })}
    </ul>
  )
}

/** 부처 보기: 부 19곳은 타일로, 나머지는 기관 탭으로 넘긴다 */
function MinistryPicker({
  ministries,
  selected,
}: {
  ministries: ReadonlyArray<MinistryTile>
  selected?: string
}) {
  const bu = ministries.filter((m) => m.group === 'bu')
  return (
    <div className="ministry-pick">
      <ul>
        {bu.map((m) => (
          <li key={m.id}>
            <Link
              to="/"
              search={{ view: 'ministries', ministry: m.id }}
              className={m.id === selected ? 'on' : m.cards ? '' : 'quiet'}
              aria-current={m.id === selected ? 'true' : undefined}
            >
              {m.name}
              <span className="s">카드 {m.cards}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/orgs" search={{ view: 'ministries' }} className="dir-go">
        처·청·위원회 포함 {ministries.length}곳 →
      </Link>
    </div>
  )
}

function MinistryCard({ panel }: { panel: MinistryPanel }) {
  const { org } = panel
  return (
    <div className="explore-card">
      <div className="explore-head">
        <h2>{org.name}</h2>
        <p>
          사업 카드 {org.cards} · 평가 {panel.total} (지역 시행 포함)
        </p>
      </div>
      {panel.top.length > 0 ? (
        <ul className="explore-reports">
          {panel.top.map((r) => (
            <li key={r.summary.slug}>
              <ReportLink subject={r.summary.subject} slug={r.summary.slug}>
                <span className="t">
                  <b>{r.summary.title}</b>
                  <span>{r.orgName}</span>
                </span>
                <StatusBadge status={r.overall} overall />
              </ReportLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dir-none">
          이 부처의 사업은 아직 평가하지 않았습니다. 평가하지 않았다는 것은
          문제가 없다는 뜻도, 있다는 뜻도 아닙니다.
        </p>
      )}
      <Link to="/orgs/$orgId" params={{ orgId: org.id }} className="dir-go">
        {org.name} 페이지 →
      </Link>
    </div>
  )
}
