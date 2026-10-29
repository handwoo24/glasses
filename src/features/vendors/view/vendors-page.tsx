// 용역 탭 /vendors (캔버스 시안 ‘업체 작업 현황’ A안을 전국 목록으로). 업체 한 줄 아래에 사업별로 맡은 일·계약 합계·단계·판정.
// 업체 카드는 사업 리포트를 게시한 뒤 업체 루프가 만든다. 그래서 목록은 게시된 사업의 업체만 담는다.
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { StatusBadge } from '#/features/reports/view/parts'
import { won } from '#/features/directory/list'
import { paginate } from '#/features/directory/paging'
import { Pager } from '#/features/directory/view/pager'
import { SIDO_TILES } from '#/features/directory/regions'
import { SidoMap } from '#/features/directory/view/sido-map'
import { stageTone } from '#/features/worklist/list'
import { filterVendors, vendorSidoCounts } from '../list'
import type {
  Engagement,
  VendorListItem,
  VendorMapBasis,
  VendorsSearch,
} from '../list'

interface VendorsPageProps {
  items: ReadonlyArray<VendorListItem>
  search: VendorsSearch
}

export function VendorsPage({ items, search }: VendorsPageProps) {
  const navigate = useNavigate({ from: '/vendors/' })
  const rows = filterVendors(items, search)
  const paged = paginate(rows, search.page)
  const set = (patch: Partial<VendorsSearch>) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
    })
  const cards = items.reduce((n, v) => n + v.engagements.length, 0)
  const published = items.reduce(
    (n, v) => n + v.engagements.filter((e) => e.summary).length,
    0,
  )
  return (
    <div className="page">
      <div className="dir">
        <header className="rp-hero">
          <h1>용역업체</h1>
          <p className="rp-lede">
            평가한 사업에 참여한 업체입니다. 업체 리포트는 ‘사업 × 업체’ 하나씩
            쓰므로, 여러 사업에 나오는 업체는 한 줄 아래에 사업별로 나눠
            적습니다.
          </p>
          <p className="rp-meta">
            <span>
              업체 <b>{items.length}</b>곳
            </span>
            <span>업체 카드 {cards}장</span>
            <span>업체 리포트 게시 {published}건</span>
          </p>
        </header>

        <div className="vendor-layout">
          <VendorMap items={items} search={search} />
          <div className="vendor-main">
            <form
              aria-label="업체 찾기"
              className="filters"
              onSubmit={(e) => {
                e.preventDefault()
                const q = new FormData(e.currentTarget).get('q')
                set({
                  q: typeof q === 'string' && q.trim() ? q.trim() : undefined,
                })
              }}
            >
              <SearchBox value={search.q} />
            </form>

            <section className="rp-sec" aria-labelledby="v-list">
              <div className="rp-sh">
                <h2 id="v-list">
                  업체 <span className="dir-n">{rows.length}</span>
                </h2>
              </div>
              {rows.length > 0 ? (
                <>
                  <ol className="vl-rows">
                    {paged.rows.map((v) => (
                      <VendorItem key={v.bizno} v={v} />
                    ))}
                  </ol>
                  <Pager paged={paged} label="용역업체 목록 쪽" />
                </>
              ) : (
                <div className="empty-state">
                  <p className="big">
                    {items.length
                      ? '조건에 맞는 업체가 없습니다'
                      : '아직 목록에 올린 업체가 없습니다'}
                  </p>
                  <p>
                    업체는 사업 리포트를 게시한 뒤 계약 기록에서 찾아 올립니다.
                    지금은 게시된 사업의 업체만 있습니다.
                  </p>
                  <p className="links">
                    <Link to="/vendors">필터 지우기</Link>
                    <Link to="/">평가한 사업 보기</Link>
                  </p>
                </div>
              )}
              <p className="dir-none">
                금액은 평가 대상 사업 안 계약의 합계입니다. 판정은 게시된 업체
                리포트만 보입니다. 부정당 제재는 조달청 나라장터에서 조회한 그날
                유효한 제재 수입니다.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

const BASIS_LABEL: Record<VendorMapBasis, string> = {
  home: '업체 소재지',
  org: '발주 기관 지역',
}

/** 시도 지도: 소재지 기준이면 ?home=, 발주 기관 기준이면 ?region= 으로 고른다 */
function VendorMap({
  items,
  search,
}: {
  items: ReadonlyArray<VendorListItem>
  search: VendorsSearch
}) {
  const by = search.by ?? 'home'
  const counts = vendorSidoCounts(items, by)
  const selected = by === 'home' ? search.home : search.region
  const tones = Object.fromEntries(
    Object.keys(SIDO_TILES).map((code) => [
      code,
      counts[code] ? ('has' as const) : ('empty' as const),
    ]),
  )
  return (
    <aside className="vendor-side">
      <nav className="seg" aria-label="지도 기준">
        {(['home', 'org'] as const).map((b) => (
          <Link
            key={b}
            to="/vendors"
            // 기준을 바꾸면 시도 고르기만 풀고 다른 필터는 둔다
            search={{
              ...search,
              by: b === 'home' ? undefined : b,
              home: undefined,
              region: undefined,
              page: undefined,
            }}
            // 빈 조건 링크가 모든 주소에서 ‘현재’로 잡히지 않게 정확히 같을 때만
            activeOptions={{ exact: true, includeSearch: true }}
            aria-current={by === b ? 'page' : undefined}
          >
            {BASIS_LABEL[b]}
          </Link>
        ))}
      </nav>
      <SidoMap
        tones={tones}
        selected={selected}
        size="sm"
        label={`${BASIS_LABEL[by]}별 업체`}
        tile={({ code, short, className }) => (
          <Link
            to="/vendors"
            activeOptions={{ exact: true, includeSearch: true }}
            search={{
              ...search,
              page: undefined,
              ...(by === 'home'
                ? { home: selected === code ? undefined : code }
                : { region: selected === code ? undefined : code }),
            }}
            className={className}
            aria-current={code === selected ? 'true' : undefined}
          >
            {short}
            {counts[code] ? <span className="s">{counts[code]}</span> : null}
          </Link>
        )}
      />
      <p className="dir-none">
        {by === 'home'
          ? '업체 본사가 있는 시도. ‘발주 기관 지역’으로 바꾸면 업체가 일을 맡은 사업의 기관 기준으로 다시 셉니다.'
          : '업체가 일을 맡은 사업의 기관이 있는 시도. 한 업체가 여러 시도에서 일하면 시도마다 셉니다.'}{' '}
        같은 시도를 한 번 더 누르면 고른 것이 풀립니다.
      </p>
    </aside>
  )
}

function VendorItem({ v }: { v: VendorListItem }) {
  const meta = [v.type, v.home].filter(Boolean).join(' · ')
  return (
    <li className="vl-row">
      <div className="vl-head">
        <span className="vl-name">
          <Link to="/vendors/$bizno" params={{ bizno: v.bizno }} title={v.name}>
            {v.name}
          </Link>
          {meta && <span className="kicker">{meta}</span>}
          {v.sanctions && v.sanctions.active > 0 && (
            <span className="vl-flag">부정당 제재 {v.sanctions.active}건</span>
          )}
        </span>
        <span className="vl-sum">
          <b>{won(v.amount)}</b>
          <span>
            {v.engagements.length > 1
              ? `사업 ${v.engagements.length}곳 합`
              : '계약 합계'}
          </span>
        </span>
      </div>
      <ul className="vl-engs">
        {v.engagements.map((e) => (
          <EngagementLine key={e.program} bizno={v.bizno} e={e} />
        ))}
      </ul>
    </li>
  )
}

function EngagementLine({ bizno, e }: { bizno: string; e: Engagement }) {
  const programId = e.program.replace(/^programs\//, '')
  return (
    <li className="vl-eng">
      <span className="what">
        <Link
          to="/programs/$programId"
          params={{ programId }}
          title={e.programName}
        >
          {e.programName}
        </Link>
        <span className="role">
          {e.orgName} · {e.role} · 계약 {e.contracts}건
        </span>
      </span>
      <span className="money">{won(e.amount)}</span>
      <span className="wl-stage" data-tone={stageTone(e.stage)}>
        {e.stage}
      </span>
      <span className="verdict">
        {e.verdict ? (
          <Link
            to="/programs/$programId/vendors/$bizno"
            params={{ programId, bizno }}
          >
            <StatusBadge status={e.verdict} overall />
          </Link>
        ) : (
          <span className="none">판정 전</span>
        )}
      </span>
    </li>
  )
}

function SearchBox({ value }: { value: string | undefined }) {
  const [q, setQ] = useState(value ?? '')
  return (
    <div className="field">
      <label className="wl-k" htmlFor="v-q">
        업체 이름·사업자등록번호
      </label>
      <span className="vl-search">
        <input
          id="v-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={40}
        />
        <button type="submit">찾기</button>
      </span>
    </div>
  )
}
