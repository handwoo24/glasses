// 기관 고르기 /orgs?view=ministries|regions — 부처(중앙행정기관)와 지역(시도 → 광역·기초)으로 기관을 찾는다.
// 평가 0건인 기관도 그대로 보인다. 평가하지 않았다는 것은 문제가 없다는 뜻도, 있다는 뜻도 아니다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import { Link } from '@tanstack/react-router'
import { SIDO, sidoOf } from '../list'
import type { DirOrg } from '../server/directory.server'

export type OrgsView = 'ministries' | 'regions'

interface OrgsPageProps {
  orgs: ReadonlyArray<DirOrg>
  view: OrgsView
}

const LOCAL = new Set<DirOrg['type']>([
  '광역자치단체',
  '기초자치단체',
  '지방의회',
  '교육청',
])

export function OrgsPage({ orgs, view }: OrgsPageProps) {
  const ministries = orgs.filter((o) => CENTRAL_TYPES.has(o.type))
  const local = orgs.filter((o) => LOCAL.has(o.type))
  return (
    <div className="page">
      <div className="dir">
        <header className="rp-hero">
          <h1>기관</h1>
          <p className="rp-lede">
            사업을 맡은 기관을 고르면 그 기관의 평가 현황과 평가 대상 사업이
            나옵니다. 지금은 2026 예산 소관인 부처·국가기관 {ministries.length}
            곳과 지자체 {local.length}곳을 목록에 올렸습니다.
          </p>
        </header>
        <nav aria-label="기관 나누기" className="dir-tabs">
          <Link
            to="/orgs"
            search={{ view: 'ministries' }}
            aria-current={view === 'ministries' ? 'page' : undefined}
          >
            부처 <span>{ministries.length}</span>
          </Link>
          <Link
            to="/orgs"
            search={{ view: 'regions' }}
            aria-current={view === 'regions' ? 'page' : undefined}
          >
            지역 <span>{local.length}</span>
          </Link>
        </nav>
        {view === 'ministries' ? (
          <OrgGrid
            orgs={[...ministries].sort(
              (a, b) =>
                b.published - a.published ||
                b.cards - a.cards ||
                a.name.localeCompare(b.name),
            )}
            empty="부처를 아직 목록에 올리지 않았습니다."
          />
        ) : (
          <Regions orgs={local} />
        )}
      </div>
    </div>
  )
}

function Regions({ orgs }: { orgs: ReadonlyArray<DirOrg> }) {
  const bySido = Object.entries(SIDO).flatMap(([code, name]) => {
    const list = orgs.filter((o) => o.region?.startsWith(code))
    return list.length ? [{ code, name, list }] : []
  })
  const unknown = orgs.filter((o) => !sidoOf(o.region))
  return (
    <>
      {bySido.map(({ code, name, list }) => (
        <section key={code} className="rp-sec" aria-labelledby={`sido-${code}`}>
          <div className="rp-sh">
            <h2 id={`sido-${code}`}>{name}</h2>
          </div>
          <OrgGrid orgs={list} />
          <p className="dir-none">
            <Link to="/programs" search={{ region: code }}>
              {name}의 평가한 사업 보기 →
            </Link>
          </p>
        </section>
      ))}
      {unknown.length > 0 && <OrgGrid orgs={unknown} />}
    </>
  )
}

function OrgGrid({
  orgs,
  empty,
}: {
  orgs: ReadonlyArray<DirOrg>
  empty?: string
}) {
  if (!orgs.length) return <p className="dir-none">{empty}</p>
  return (
    <ul className="org-chips">
      {orgs.map((o) => (
        <li key={o.id}>
          <Link
            to="/orgs/$orgId"
            params={{ orgId: o.id }}
            className={o.published > 0 ? 'org-chip on' : 'org-chip'}
          >
            <b>{o.name}</b>
            <span>
              {o.type} · 평가 {o.published}
              {o.cards > 0 && ` · 대상 ${o.cards}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
