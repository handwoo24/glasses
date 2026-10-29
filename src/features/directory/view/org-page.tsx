// 기관 페이지 /orgs/{기관코드} (캔버스 시안 ‘기관 · 부처’ Org-v3 · Ministry-v3).
// 기관이 무엇이고, glasses가 무엇을 평가했고(분모와 함께), 다음 판단은 언제이고, 어디서 더 알아보는지.
// 점수·순위·단체장 이름은 싣지 않는다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import { Link } from '@tanstack/react-router'
import { STATUS_INFO } from '#/features/reports/axes'
import { DDay, StatusBadge } from '#/features/reports/view/parts'
import { ReportLink } from '#/features/reports/view/report-link'
import { STATUS_TONE, summarize } from '#/features/reports/assessment'
import { distribution, nextDateOf, sidoOf, won } from '../list'
import type { Distribution, ListedReport } from '../list'
import type { BudgetEntry, DirOrg, OrgPage } from '../server/directory.server'
import { ReportRows } from './report-rows'

const DIST_ORDER = ['fix', 'watch', 'on-track', 'unknown'] as const
/** 기관 페이지에 바로 보이는 리포트 줄 수. 나머지는 사업 목록(쪽 나눔)에서 */
const ORG_ROWS = 10

interface OrgPageViewProps {
  data: OrgPage
  today: string
}

export function OrgPageView({ data, today }: OrgPageViewProps) {
  const { org, parent, catalog } = data
  const ministry = CENTRAL_TYPES.has(org.type)
  const own = data.reports.filter((r) => r.org === org.id)
  const regional = data.reports.filter((r) => r.org !== org.id)
  const sido = sidoOf(org.region)
  return (
    <div className="page">
      <div className="dir">
        <nav aria-label="경로" className="wl-crumb">
          <Link to="/orgs">전국</Link>
          {parent && (
            <>
              <span aria-hidden="true">›</span>
              <Link to="/orgs/$orgId" params={{ orgId: parent.id }}>
                {parent.name}
              </Link>
            </>
          )}
          <span aria-hidden="true">›</span>
          <span>{org.name}</span>
        </nav>

        <header className="rp-hero">
          <p className="chips">
            <span className="chip on">{org.type}</span>
            {sido && sido !== org.name && <span className="chip">{sido}</span>}
            <span className="chip">기관코드 {org.id}</span>
          </p>
          <h1>{org.name}</h1>
          <dl className="rp-facts">
            {parent && (
              <div>
                <dt>상급 기관</dt>
                <dd>
                  <Link to="/orgs/$orgId" params={{ orgId: parent.id }}>
                    {parent.name}
                  </Link>
                </dd>
              </div>
            )}
            {catalog && (
              <>
                <div>
                  <dt>{catalog.year} 예산현액</dt>
                  <dd>
                    <b>{won(catalog.amount)}</b>
                  </dd>
                </div>
                <div>
                  <dt>세부사업</dt>
                  <dd>
                    {catalog.lines.toLocaleString('ko-KR')}건 ·{' '}
                    {ministry ? '열린재정' : '지방재정365'}
                    {catalog.asOf &&
                      ` ${catalog.asOf.replaceAll('-', '. ')}. 기준`}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </header>

        <div className="dir-top">
          <Coverage data={data} own={own} />
          <NextBox reports={data.reports} today={today} />
        </div>

        <section className="rp-sec" aria-labelledby="o-s1">
          <div className="rp-sh">
            <span className="no">01</span>
            <h2 id="o-s1">평가한 사업</h2>
          </div>
          {own.length > 0 ? (
            <>
              <ReportRows rows={own.slice(0, ORG_ROWS)} today={today} />
              {own.length > ORG_ROWS && (
                <p className="dir-none">
                  <Link
                    to="/programs"
                    search={{ org: org.id }}
                    className="dir-go"
                  >
                    {org.name}의 평가 {own.length}건 모두 보기 →
                  </Link>
                </p>
              )}
            </>
          ) : (
            <p className="dir-none">
              아직 게시한 리포트가 없습니다.{' '}
              {org.cards > 0 && (
                <Link to="/orgs/$orgId/programs" params={{ orgId: org.id }}>
                  평가 대상 사업 {org.cards}개의 작업 현황 보기
                </Link>
              )}
            </p>
          )}
        </section>

        {ministry && (
          <section className="rp-sec" aria-labelledby="o-s-nat">
            <div className="rp-sh">
              <span className="no">02</span>
              <h2 id="o-s-nat">국고보조 사업과 지역별 시행</h2>
            </div>
            {regional.length > 0 ? (
              <>
                <ReportRows
                  rows={regional.slice(0, ORG_ROWS)}
                  today={today}
                  showOrg
                />
                {regional.length > ORG_ROWS && (
                  <p className="dir-none">
                    <Link
                      to="/programs"
                      search={{ ministry: org.id }}
                      className="dir-go"
                    >
                      지역 시행 {regional.length}건 모두 보기 →
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p className="dir-none">
                평가한 지역 시행 사업이 없습니다. 지역 사업 카드가 이 부처의
                사업을 가리키면 여기에 지역별 판정이 모입니다.
              </p>
            )}
          </section>
        )}

        {data.budgets.length > 0 && (
          <section className="rp-sec" aria-labelledby="o-s2">
            <div className="rp-sh">
              <span className="no">{ministry ? '03' : '02'}</span>
              <h2 id="o-s2">재정 문서</h2>
            </div>
            <BudgetChain orgId={org.id} budgets={data.budgets} />
          </section>
        )}

        <section className="rp-sec" aria-labelledby="o-s3">
          <div className="rp-sh">
            <span className="no">관계</span>
            <h2 id="o-s3">함께 보는 기관</h2>
          </div>
          <Relations data={data} />
        </section>

        <section className="rp-sec" aria-labelledby="o-s4">
          <div className="rp-sh">
            <span className="no">더 알아보기</span>
            <h2 id="o-s4">더 알아보는 방법</h2>
          </div>
          <ul className="dir-more">
            <li>
              <span className="k">정보공개청구</span>
              <span>
                <a href="https://www.open.go.kr" rel="noreferrer">
                  정보공개포털
                </a>
                에서 기관 ‘{org.name}’
              </span>
            </li>
            <li>
              <span className="k">질의</span>
              <a href="https://www.epeople.go.kr" rel="noreferrer">
                국민신문고
              </a>
            </li>
            <li>
              <span className="k">예산</span>
              {ministry ? (
                <a href="https://www.openfiscaldata.go.kr" rel="noreferrer">
                  열린재정 부처별 예산
                </a>
              ) : (
                <span>
                  <a href="https://www.lofin365.go.kr" rel="noreferrer">
                    지방재정365
                  </a>
                  {org.lafCd && ` 자치단체 코드 ${org.lafCd}`}
                </span>
              )}
            </li>
            {org.sourceHosts.slice(0, 2).map((h) => (
              <li key={h}>
                <span className="k">누리집</span>
                <a href={`https://${h}`} rel="noreferrer">
                  {h}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Coverage({
  data,
  own,
}: {
  data: OrgPage
  own: ReadonlyArray<ListedReport>
}) {
  const { org, catalog } = data
  const programs = own.filter((r) => r.kind === 'program').length
  const budgets = own.length - programs
  const dist = distribution(own)
  return (
    <section aria-labelledby="o-cov" className="cover">
      <h2 id="o-cov" className="wl-k">
        glasses가 평가한 것
      </h2>
      <p className="count">
        <b>{own.length}건</b>
        <span>
          사업 {programs} · 재정 문서 {budgets}
        </span>
        <span className="of">
          / 평가 대상 사업 {org.cards}개
          {catalog &&
            ` · ${catalog.year}년 세부사업 ${catalog.lines.toLocaleString('ko-KR')}건 중`}
        </span>
      </p>
      {own.length > 0 && <Dist dist={dist} />}
      <p className="note">
        {own.length > 0
          ? `평가는 문제가 보이는 사업부터 합니다. 이 분포는 ${org.name}의 성적이 아닙니다.`
          : '평가하지 않았다는 것은 문제가 없다는 뜻도, 있다는 뜻도 아닙니다.'}
      </p>
      {org.cards > 0 && (
        <p>
          <Link
            to="/orgs/$orgId/programs"
            params={{ orgId: org.id }}
            className="dir-go"
          >
            평가 대상 사업과 작업 현황 →
          </Link>
        </p>
      )}
    </section>
  )
}

function Dist({ dist }: { dist: Distribution }) {
  const label = DIST_ORDER.map(
    (s) => `${STATUS_INFO[s].overall} ${dist[s]}건`,
  ).join(', ')
  return (
    <div className="dist-box">
      <div className="dist" role="img" aria-label={`판정 분포: ${label}`}>
        {DIST_ORDER.filter((s) => dist[s] > 0).map((s) => (
          <span
            key={s}
            className={STATUS_TONE[s]}
            style={{ flexGrow: dist[s] }}
          />
        ))}
      </div>
      <p className="dist-legend" aria-hidden="true">
        {DIST_ORDER.map((s) => (
          <span key={s}>
            <StatusBadge status={s} overall /> {dist[s]}
          </span>
        ))}
      </p>
    </div>
  )
}

/** 이 기관의 리포트에서 오늘 이후 가장 가까운 판단 시점과 그다음 셋 */
function NextBox({
  reports,
  today,
}: {
  reports: ReadonlyArray<ListedReport>
  today: string
}) {
  const upcoming = reports
    .flatMap((r) => {
      const d = nextDateOf(r.summary, today)
      return d ? [{ ...d, r }] : []
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const first = upcoming.at(0)
  const rest = upcoming.slice(1)
  return (
    <section aria-labelledby="o-next" className="next-box">
      <h2 id="o-next" className="wl-k">
        이 기관의 다음 판단 시점
      </h2>
      {first ? (
        <>
          <p className="when">
            <b>{first.when}</b> <DDay date={first.date} />
          </p>
          <ReportLink
            subject={first.r.summary.subject}
            slug={first.r.summary.slug}
          >
            {first.what} · {first.r.summary.title}
          </ReportLink>
          {rest.length > 0 && (
            <ol>
              {rest.slice(0, 3).map((d) => (
                <li key={`${d.r.summary.slug}-${d.when}`}>
                  <b>{d.when}</b> {d.what} · {d.r.summary.title}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="s">평가한 사업이 생기면 여기에 날짜가 모입니다.</p>
      )}
    </section>
  )
}

const KIND_LABEL = { 본예산: '본예산', 추경: '추경', 결산: '결산' } as const

function BudgetChain({
  orgId,
  budgets,
}: {
  orgId: string
  budgets: ReadonlyArray<BudgetEntry>
}) {
  return (
    <ol className="budget-chain">
      {budgets.map((b) => {
        const tone = b.summary
          ? STATUS_TONE[summarize(b.summary).overall]
          : undefined
        return (
          <li
            key={b.id}
            className={tone}
            aria-current={b.summary ? 'true' : undefined}
          >
            <span className="state">
              {b.doc.year} · {KIND_LABEL[b.doc.kind]}
              {b.doc.round ? ` ${b.doc.round}회` : ''}
            </span>
            {b.summary ? (
              <ReportLink
                subject={`orgs/${orgId}/budgets/${b.id}`}
                slug={b.summary.slug}
              >
                {b.doc.name}
              </ReportLink>
            ) : (
              <span>{b.doc.name}</span>
            )}
            {b.doc.total !== undefined && (
              <span className="amount">{won(b.doc.total)}</span>
            )}
            <span className="state">{b.summary ? '평가함' : '평가 전'}</span>
          </li>
        )
      })}
    </ol>
  )
}

function OrgCard({ o, k }: { o: DirOrg; k: string }) {
  return (
    <Link to="/orgs/$orgId" params={{ orgId: o.id }} className="rel-card">
      <span className="k">{k}</span>
      <b title={o.name}>{o.name}</b>
      <span className="s">
        {o.type} · 평가 {o.published}
        {o.cards > 0 && ` · 대상 ${o.cards}`}
      </span>
    </Link>
  )
}

/** 처음 보이는 하위 기관 수 */
const CHILD_PAGE = 8

function Relations({ data }: { data: OrgPage }) {
  const kids = [...data.children].sort(
    (a, b) => b.published - a.published || b.cards - a.cards,
  )
  return (
    <div className="rel-cards">
      {data.parent && <OrgCard o={data.parent} k="상급 기관" />}
      {kids.slice(0, CHILD_PAGE).map((c) => (
        <OrgCard
          key={c.id}
          o={c}
          k={CENTRAL_TYPES.has(data.org.type) ? '소속기관' : '하위 기관'}
        />
      ))}
      <Link to="/orgs" className="rel-card">
        <span className="k">다른 기관</span>
        <b>
          {CENTRAL_TYPES.has(data.org.type) ? '부처 목록' : '지역별 기관 목록'}
        </b>
        <span className="s">
          {kids.length > CHILD_PAGE
            ? `하위 기관 ${kids.length - CHILD_PAGE}곳 더`
            : data.siblings > 0
              ? `같은 상급 기관 아래 ${data.siblings}곳`
              : '전국'}
        </span>
      </Link>
    </div>
  )
}
