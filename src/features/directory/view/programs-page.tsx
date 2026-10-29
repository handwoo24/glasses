// 사업 목록 /programs?region=&ministry=&field=&verdict=&kind=&sort= (캔버스 시안 ‘홈 · 목록’ Programs-v3).
// 평가해 게시한 사업과 재정 문서만 보인다. 필터는 주소에 남아 그대로 공유된다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import { Link, useNavigate } from '@tanstack/react-router'
import { STATUS_INFO } from '#/features/reports/axes'
import { KINDS, LIST_SORTS, SIDO, filterReports } from '../list'
import type { ProgramsSearch } from '../list'
import type { Directory } from '../server/directory.server'
import { paginate } from '../paging'
import { Pager } from './pager'
import { ReportRows } from './report-rows'

interface ProgramsPageProps {
  data: Directory
  search: ProgramsSearch
  today: string
}

const VERDICTS = ['fix', 'watch', 'on-track', 'unknown'] as const

export function ProgramsPage({ data, search, today }: ProgramsPageProps) {
  const navigate = useNavigate({ from: '/programs/' })
  const rows = filterReports(data.reports, search, today)
  const paged = paginate(rows, search.page)
  // 필터가 바뀌면 첫 쪽으로
  const set = (patch: Partial<ProgramsSearch>) =>
    void navigate({
      search: (prev) => ({ ...prev, ...patch, page: undefined }),
    })
  const sido = search.region ? SIDO[search.region] : undefined
  const ministry = data.orgs.find((o) => o.id === search.ministry)
  const org = data.orgs.find((o) => o.id === search.org)
  const scopeOrgs = data.orgs.filter(
    (o) =>
      (!search.region || o.region?.startsWith(search.region)) &&
      (!search.ministry || o.id === search.ministry) &&
      (!search.org || o.id === search.org),
  )
  const regions = Object.entries(SIDO).filter(([code]) =>
    data.orgs.some((o) => o.region?.startsWith(code)),
  )
  const ministries = data.orgs.filter((o) => CENTRAL_TYPES.has(o.type))
  return (
    <div className="page">
      <div className="dir">
        <nav aria-label="경로" className="wl-crumb">
          <Link to="/orgs">전국</Link>
          <span aria-hidden="true">›</span>
          <span>사업 목록</span>
        </nav>
        <header className="rp-hero">
          <h1>{org?.name ?? ministry?.name ?? sido ?? '평가한 사업'}</h1>
          <p className="rp-lede">
            {scopeOrgs.length}개 기관 · 평가 {rows.length}건 · 평가 대상 사업{' '}
            {scopeOrgs.reduce((n, o) => n + o.cards, 0).toLocaleString('ko-KR')}
            개
          </p>
        </header>

        <form
          aria-label="필터"
          className="filters"
          onSubmit={(e) => e.preventDefault()}
        >
          <Select
            id="f-region"
            label="지역"
            value={search.region}
            all="전국"
            options={regions}
            onChange={(region) => set({ region })}
          />
          <Select
            id="f-ministry"
            label="부처"
            value={search.ministry}
            all="전체"
            options={ministries.map((o) => [o.id, o.name] as const)}
            onChange={(m) => set({ ministry: m })}
          />
          <Select
            id="f-field"
            label="분야"
            value={search.field}
            all="전체"
            options={data.sectors.map((s) => [s, s] as const)}
            onChange={(field) => set({ field })}
          />
          <Select
            id="f-verdict"
            label="종합 판정"
            value={search.verdict}
            all="전체"
            options={VERDICTS.map((v) => [v, STATUS_INFO[v].overall] as const)}
            onChange={(v) => set({ verdict: v as ProgramsSearch['verdict'] })}
          />
          <Select
            id="f-kind"
            label="대상"
            value={search.kind}
            all="사업과 재정 문서"
            options={Object.entries(KINDS)}
            onChange={(k) => set({ kind: k as ProgramsSearch['kind'] })}
          />
          <div className="field sort">
            <label className="wl-k" htmlFor="f-sort">
              정렬
            </label>
            <select
              id="f-sort"
              value={search.sort ?? 'next'}
              onChange={(e) =>
                set({
                  sort:
                    e.target.value === 'next'
                      ? undefined
                      : (e.target.value as ProgramsSearch['sort']),
                })
              }
            >
              {Object.entries(LIST_SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </form>

        <section className="rp-sec" aria-labelledby="p-list">
          <div className="rp-sh">
            <h2 id="p-list">
              사업과 재정 문서 <span className="dir-n">{rows.length}</span>
            </h2>
          </div>
          {rows.length > 0 ? (
            <>
              <ReportRows rows={paged.rows} today={today} showOrg />
              <Pager paged={paged} label="사업 목록 쪽" />
            </>
          ) : (
            <div className="empty-state">
              <p className="big">조건에 맞는 평가가 아직 없습니다</p>
              <p>
                평가는 공개 자료에서 문제가 보이는 사업부터 합니다. 평가하지
                않았다는 것은 문제가 없다는 뜻도, 있다는 뜻도 아닙니다.
              </p>
              <p className="links">
                <Link to="/programs">필터 지우기</Link>
                <Link to="/orgs" search={{ view: 'regions' }}>
                  기관별 평가 대상 사업 보기
                </Link>
              </p>
            </div>
          )}
          <p className="dir-none">
            막대는 7개 축을 상태별로 센 것입니다. 진한 노랑은 개선 필요, 옅은
            노랑은 지켜볼 점, 남색은 순항, 회색은 판단 불가입니다.
          </p>
        </section>
      </div>
    </div>
  )
}

interface SelectProps {
  id: string
  label: string
  value: string | undefined
  all: string
  options: ReadonlyArray<readonly [string, string]>
  onChange: (v: string | undefined) => void
}

function Select({ id, label, value, all, options, onChange }: SelectProps) {
  return (
    <div className="field">
      <label className="wl-k" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{all}</option>
        {options.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
