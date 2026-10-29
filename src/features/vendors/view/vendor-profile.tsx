// 업체 페이지 (캔버스 시안 ‘업체 페이지’): 사업자등록번호 하나가 평가 대상 사업에서 맡은 일과 사업별 업체 리포트.
// 업체 하나에 판정 하나를 매기지 않는다. 판정은 사업 × 업체 리포트마다 따로 있다.
import { Link } from '@tanstack/react-router'
import { STATUS_INFO } from '#/features/reports/axes'
import type { AxisStatus } from '#/features/reports/axes'
import { STATUS_TONE } from '#/features/reports/assessment'
import { StatusBadge } from '#/features/reports/view/parts'
import { eok, stageTone } from '#/features/worklist/list'
import type { VendorPage } from '#/features/worklist/server/worklist.server'
import { VENDOR_AXIS_IDS, VENDOR_AXIS_INFO, vendorOverallStatus } from '../axes'
import type { VendorSummary } from '../summary'

const dot = (iso: string) =>
  iso
    .split('-')
    .map((n, i) => (i === 0 ? n : String(Number(n))))
    .join('. ') + '.'

function verdictOf(s: VendorSummary): AxisStatus {
  const statuses = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, s.axes[a].status]),
  ) as Parameters<typeof vendorOverallStatus>[0]
  return vendorOverallStatus(
    statuses,
    Object.fromEntries(VENDOR_AXIS_IDS.map((a) => [a, s.axes[a].evidence])),
  )
}

/** 6개 축 막대 + 축 이름 문장 */
function VendorAxisBar({ axes }: { axes: VendorSummary['axes'] }) {
  const order: ReadonlyArray<AxisStatus> = [
    'fix',
    'watch',
    'on-track',
    'unknown',
  ]
  const groups = order
    .map((status) => ({
      status,
      axes: VENDOR_AXIS_IDS.filter((a) => axes[a].status === status),
    }))
    .filter((g) => g.axes.length > 0)
  const label = groups
    .map(
      (g) =>
        `${STATUS_INFO[g.status].label} ${g.axes.length}(${g.axes.map((a) => VENDOR_AXIS_INFO[a].label).join(', ')})`,
    )
    .join(', ')
  return (
    <span className="axis-sum detail">
      <span className="bar" role="img" aria-label={`6개 축: ${label}`}>
        {groups.map((g) => (
          <span
            key={g.status}
            className={STATUS_TONE[g.status]}
            style={{ flexGrow: g.axes.length }}
          />
        ))}
      </span>
      <span className="txt" aria-hidden="true">
        {groups.map((g) => (
          <span key={g.status} className={STATUS_TONE[g.status]}>
            <b>
              {STATUS_INFO[g.status].label} {g.axes.length}
            </b>{' '}
            {g.axes.map((a) => VENDOR_AXIS_INFO[a].label).join(', ')}
          </span>
        ))}
      </span>
    </span>
  )
}

export function VendorProfilePage({ data }: { data: VendorPage }) {
  const { registry: r, engagements } = data
  const name = r?.name ?? engagements[0].name
  const total = engagements.reduce((s, e) => s + e.amount, 0)
  const contracts = engagements.flatMap((e) =>
    e.contracts.map((c) => ({ ...c, program: e.programName })),
  )
  const orgs = new Set(engagements.map((e) => e.orgName)).size
  const published = engagements.filter((e) => e.summary).length
  const bizno = `${data.bizno.slice(0, 3)}-${data.bizno.slice(3, 5)}-${data.bizno.slice(5)}`
  return (
    <div className="page">
      <div className="vp">
        <header className="vp-top">
          <nav aria-label="경로" className="wl-crumb">
            <Link to="/">전국</Link>
            <span aria-hidden="true">›</span>
            <span>업체</span>
          </nav>
          <p className="wl-chips">
            <span className="on">{r?.type ?? '업체'}</span>
            {r?.type === '법인' && <span>사업자등록번호 {bizno}</span>}
          </p>
          <h1>{name}</h1>
          <p className="vp-lede">
            평가 대상 사업 <b>{engagements.length}개</b>에 참여했습니다 · 기관{' '}
            {orgs}곳 · 계약 {contracts.length}건, 합계 <b>{eok(total)} 원</b> ·
            게시된 업체 리포트 {published}
          </p>
        </header>

        {r && (
          <section aria-labelledby="vp-reg" className="vp-reg">
            <div className="vp-k-row">
              <h2 id="vp-reg" className="wl-k">
                업체 기본 정보 · 나라장터 업체 정보
              </h2>
              {r.sanctions && <span>{dot(r.sanctions.checkedAt)} 조회</span>}
            </div>
            <dl>
              <div>
                <dt>소재지</dt>
                <dd>{r.region ?? '—'}</dd>
              </div>
              <div>
                <dt>개업일</dt>
                <dd>{r.openedAt ? dot(r.openedAt.slice(0, 7)) : '—'}</dd>
              </div>
              <div>
                <dt>종업원</dt>
                <dd>{r.employees !== undefined ? `${r.employees}명` : '—'}</dd>
              </div>
              <div>
                <dt>등록 업무</dt>
                <dd>{r.businesses.join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt>부정당 제재 (조회 시점 유효)</dt>
                <dd>{r.sanctions ? `${r.sanctions.active}건` : '조회 전'}</dd>
              </div>
            </dl>
            <p className="vp-note">
              이 정보는 업체를 평가하지 않습니다. 평가는 아래 사업마다 따로 있는
              업체 리포트에서 합니다.
            </p>
          </section>
        )}

        <section aria-labelledby="vp-list" className="wl-sec">
          <div className="wl-sh">
            <h2 id="vp-list">
              사업별 업체 리포트 <span>{engagements.length}</span>
            </h2>
            <span>게시된 리포트 먼저 · 그다음 금액 큰 순</span>
          </div>
          <div className="vp-head" aria-hidden="true">
            <span>사업 · 이 업체가 맡은 일</span>
            <span className="r">이 사업 안 계약</span>
            <span>단계</span>
            <span>판정 · 6개 축</span>
          </div>
          <ol className="vp-rows">
            {engagements.map((e) => {
              const programId = e.program.replace(/^programs\//, '')
              const body = (
                <>
                  <span className="vp-name">
                    <span className="wl-k">
                      {[e.orgName, e.departments.join(', ')]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <b>{e.programName}</b>
                    <span className="sub">
                      {e.role} · 계약 {e.contracts.length}건
                    </span>
                  </span>
                  <span className="vp-money">{eok(e.amount)}</span>
                  <span>
                    <span className="wl-stage" data-tone={stageTone(e.stage)}>
                      {e.stage}
                    </span>
                  </span>
                  <span className="vp-judge">
                    {e.summary ? (
                      <>
                        <StatusBadge status={verdictOf(e.summary)} overall />
                        <VendorAxisBar axes={e.summary.axes} />
                        {e.summary.nextDates[0] && (
                          <span className="sub">
                            다음 판단 <b>{e.summary.nextDates[0].when}</b>{' '}
                            {e.summary.nextDates[0].what}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="sub">
                        {e.stage === '대기'
                          ? '아직 리포트를 쓰기 전입니다'
                          : '리포트 작성 중 · 게시되면 판정이 여기 보입니다'}
                      </span>
                    )}
                  </span>
                </>
              )
              return (
                <li key={e.program}>
                  {e.summary ? (
                    <Link
                      className="vp-row"
                      to="/programs/$programId/vendors/$bizno"
                      params={{ programId, bizno: data.bizno }}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="vp-row">{body}</div>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="vp-note">
            업체 하나에 판정 하나를 매기지 않습니다. 리포트는 ‘사업 × 업체’마다
            따로 쓰고, ⑥ 이력도 그 사업의 계약과 같은 종류의 기록인지로
            리포트마다 판정합니다. 평가 대상이 아닌 사업의 계약은 이 목록에
            들어오지 않습니다.
          </p>
        </section>

        <section aria-labelledby="vp-con" className="wl-sec">
          <div className="wl-sh">
            <h2 id="vp-con">
              계약 <span>{contracts.length}</span>
            </h2>
            <span>업체 카드에 적힌 계약 · 최종 계약 금액</span>
          </div>
          <div className="vp-tbwrap">
            <table className="vp-tb">
              <thead>
                <tr>
                  <th scope="col">계약명</th>
                  <th scope="col">계약번호</th>
                  <th scope="col">종류</th>
                  <th scope="col">기간</th>
                  <th scope="col" className="n">
                    금액
                  </th>
                  <th scope="col">사업</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.no}>
                    <td>{c.name}</td>
                    <td className="mono">{c.no}</td>
                    <td>{c.kind}</td>
                    <td>
                      {dot(c.from.slice(0, 7))} ~ {dot(c.to.slice(0, 7))}
                    </td>
                    <td className="n">{c.amount.toLocaleString('ko-KR')}</td>
                    <td>{c.program}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
