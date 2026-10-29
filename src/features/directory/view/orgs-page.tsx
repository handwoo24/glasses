// 지역 탭 /orgs?view=regions&sido=41 과 부처 탭 /orgs?view=ministries (캔버스 시안 ‘개편 · 부처·지역·용역’).
// 평가 0건인 기관도 그대로 보인다. 평가하지 않았다는 것은 문제가 없다는 뜻도, 있다는 뜻도 아니다.
import { Link } from '@tanstack/react-router'
import { MINISTRY_GROUPS, toneOf } from '../regions'
import type {
  MinistryTile,
  RegionData,
  SidoPanel,
} from '../server/explorer.server'
import { MapKey, SidoMap, VerdictBar } from './sido-map'

/** 부가 아닌 묶음에서 카드가 이보다 적은 기관은 타일 대신 칩 줄로 보인다 */
const CHIP_BELOW = 2

export function RegionPage({ data }: { data: RegionData }) {
  const { panel } = data
  const tones = Object.fromEntries(
    Object.entries(data.stats).map(([code, s]) => [code, toneOf(s)]),
  )
  return (
    <div className="page">
      <div className="dir region-page">
        <aside className="region-side">
          <p className="k">시도 바꾸기</p>
          <SidoMap
            tones={tones}
            selected={panel.code}
            size="sm"
            label="시도"
            tile={({ code, short, className }) => (
              <Link
                to="/orgs"
                search={{ view: 'regions', sido: code }}
                className={className}
                aria-current={code === panel.code ? 'true' : undefined}
              >
                {short}
              </Link>
            )}
          />
          <MapKey />
        </aside>
        <div className="region-main">
          <header className="rp-hero">
            <h1>{panel.name}</h1>
            <p className="rp-lede">{regionLede(panel)}</p>
          </header>
          <RegionOrgs panel={panel} />
        </div>
      </div>
    </div>
  )
}

function regionLede({ stat }: SidoPanel): string {
  if (!stat.orgs) return '이 시도의 기관은 아직 목록에 올리지 않았습니다.'
  return `목록에 올린 기관 ${stat.orgs}곳, 평가 대상 사업 카드 ${stat.cards}개, 평가한 사업 ${stat.published}개입니다.`
}

function RegionOrgs({ panel }: { panel: SidoPanel }) {
  const wide = panel.orgs.filter((o) => o.type === '광역자치단체')
  const local = panel.orgs.filter((o) => o.type !== '광역자치단체')
  return (
    <>
      {wide.map((o) => (
        <Link
          key={o.id}
          to="/orgs/$orgId"
          params={{ orgId: o.id }}
          className="wide-card"
        >
          <span className="t">
            <span className="k">광역자치단체</span>
            <b>{o.name}</b>
            <VerdictBar verdicts={o.verdicts} className="thin" />
          </span>
          <span className="n">
            <span>
              <span className="k">카드</span>
              <b>{o.cards}</b>
            </span>
            <span>
              <span className="k">평가</span>
              <b>{o.published}</b>
            </span>
          </span>
        </Link>
      ))}
      <section className="rp-sec" aria-labelledby="r-local">
        <div className="rp-sh">
          <h2 id="r-local">시군구 · 의회 · 교육청</h2>
        </div>
        {local.length > 0 ? (
          <ul className="org-tiles">
            {local.map((o) => (
              <li key={o.id}>
                <Link
                  to="/orgs/$orgId"
                  params={{ orgId: o.id }}
                  className={o.cards ? 'org-tile' : 'org-tile quiet'}
                >
                  <b>{o.name}</b>
                  <span className="s">
                    {o.cards
                      ? `카드 ${o.cards} · 평가 ${o.published}`
                      : '기관 등록 · 목록 전'}
                  </span>
                  {o.cards > 0 && (
                    <VerdictBar verdicts={o.verdicts} className="thin" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dir-none">
            이 시도의 시군구·의회·교육청은 아직 목록에 올리지 않았습니다.
          </p>
        )}
        <p className="dir-none">목록에 올린 기관만 보입니다.</p>
      </section>
    </>
  )
}

export function MinistriesPage({
  ministries,
}: {
  ministries: ReadonlyArray<MinistryTile>
}) {
  const max = Math.max(1, ...ministries.map((m) => m.cards))
  const cards = ministries.reduce((n, m) => n + m.cards, 0)
  const published = ministries.reduce((n, m) => n + m.published, 0)
  return (
    <div className="page">
      <div className="dir">
        <header className="rp-hero">
          <h1>부처</h1>
          <p className="rp-lede">
            중앙 {ministries.length}곳. 2026 확정 예산 1,000억 원 이상 재량 사업{' '}
            {cards}개를 골랐고, 그중 {published}개를 평가했습니다. 막대는 고른
            사업 수입니다.
          </p>
        </header>
        <div className="ministry-groups">
          {MINISTRY_GROUPS.map((g) => {
            const list = ministries.filter((m) => m.group === g.id)
            if (!list.length) return null
            const tiles =
              g.id === 'bu' ? list : list.filter((m) => m.cards >= CHIP_BELOW)
            const chips = list.filter((m) => !tiles.includes(m))
            return (
              <section
                key={g.id}
                className="ministry-group"
                aria-labelledby={`mg-${g.id}`}
              >
                <div className="gh">
                  <h2 id={`mg-${g.id}`}>{g.name}</h2>
                  <span className="k">
                    {list.length}곳 · 카드{' '}
                    {list.reduce((n, m) => n + m.cards, 0)}
                  </span>
                </div>
                <div className="gb">
                  {tiles.length > 0 && (
                    <ul className="org-tiles">
                      {tiles.map((m) => (
                        <li key={m.id}>
                          <Link
                            to="/orgs/$orgId"
                            params={{ orgId: m.id }}
                            className={m.cards ? 'org-tile' : 'org-tile quiet'}
                          >
                            <b>{m.name}</b>
                            <span className="s">
                              카드 {m.cards}
                              {m.published > 0 && ` · 평가 ${m.published}`}
                            </span>
                            {m.cards > 0 && (
                              <span className="fill">
                                <span
                                  style={{
                                    width: `${Math.max(2, (m.cards / max) * 100)}%`,
                                  }}
                                />
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {chips.length > 0 && (
                    <ul className="org-pills">
                      {chips.map((m) => (
                        <li key={m.id}>
                          <Link
                            to="/orgs/$orgId"
                            params={{ orgId: m.id }}
                            className={m.cards ? 'has' : undefined}
                          >
                            {m.name}
                            {m.cards > 0 && ` ${m.cards}`}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
