// 기관별 사업 목록 · 작업 현황 (캔버스 시안 ‘작업 현황’ Worklist-v4). 평가 대상 사업과 각 사업이 리포트 작업의 어디까지 왔는지
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { summarize } from '#/features/reports/assessment'
import { AxisRing } from '#/features/reports/view/axis-ring'
import { StatusBadge } from '#/features/reports/view/parts'
import {
  NO_DEPT,
  SORTS,
  STAGE_FILTERS,
  deptGroups,
  eok,
  filterItems,
  spentRate,
  stageCounts,
  stageTone,
} from '../list'
import type { DeptGroup, Sort, WorklistSearch } from '../list'
import type { OrgWorklist, WorkItem } from '../server/worklist.server'
import { NEXT_STEP, WORK_STAGES } from '../stage'
import type { WorkStage } from '../stage'

/** 처음 보이는 사업·부서 수 */
const PAGE = 30
const DEPT_PAGE = 6
/** 집행률이 이보다 낮으면 강조한다(10억 이상 사업만). 판정이 아니라 살펴볼 신호 */
const LOW_RATE = 0.3
const BIG = 1e9

const PRIORITY = { high: '높음', medium: '중간', low: '낮음' } as const
/** 진행 막대의 칸: 수집 → 분석 → 작성 → 검증 → 게시 대기 → 게시 */
const BAR_STEPS: Record<WorkStage, number> = {
  대기: 0,
  수집: 1,
  분석: 2,
  작성: 3,
  검증: 4,
  고침: 4,
  '게시 대기': 5,
  게시: 6,
}

interface WorklistPageProps {
  data: OrgWorklist
  search: WorklistSearch
}

export function WorklistPage({ data, search }: WorklistPageProps) {
  const { org, catalog, items } = data
  const deptScope = filterItems(items, { dept: search.dept })
  const counts = stageCounts(deptScope)
  const rows = filterItems(items, search)
  const working = WORK_STAGES.filter((s) => stageTone(s) === 'work').reduce(
    (n, s) => n + counts[s],
    0,
  )
  return (
    <div className="page">
      <div className="wl">
        <div className="wl-top">
          <nav aria-label="경로" className="wl-crumb">
            <Link to="/">전국</Link>
            {org.parentName && (
              <>
                <span aria-hidden="true">›</span>
                <span>{org.parentName}</span>
              </>
            )}
            <span aria-hidden="true">›</span>
            <span>{org.name}</span>
          </nav>
          <p className="wl-chips">
            <span className="on">{org.type}</span>
            {org.parentName && <span>{org.parentName}</span>}
            <span>기관코드 {org.id}</span>
          </p>
          <h1>{org.name} 사업</h1>
          <p className="wl-meta">
            평가 대상 {items.length}개
            {catalog &&
              ` · ${catalog.year}년 세부사업 ${catalog.lines.toLocaleString('ko-KR')}건 중 · 지방재정365 ${dotDate(catalog.asOf)} 기준`}
          </p>
        </div>

        <div className="wl-cover">
          <section aria-labelledby="wl-stage" className="wl-stage-box">
            <h2 id="wl-stage" className="wl-k">
              작업 현황{search.dept && ` · ${search.dept}`}
            </h2>
            <p className="wl-big">
              <b>{counts['게시']}개 게시</b>
              <span>
                작업 중 {working} · 대기 {counts['대기']}
              </span>
            </p>
            <div className="wl-steps" role="group" aria-label="단계별 사업 수">
              {WORK_STAGES.map((s) => (
                <StageStep
                  key={s}
                  stage={s}
                  count={counts[s]}
                  search={search}
                />
              ))}
            </div>
            <p className="wl-note">
              단계는 사람이 적지 않습니다. 모은 자료, 사실 원장, 리포트 초안,
              검증 기록이 남으면 그에 따라 정해집니다. 검증은 리포트를 쓴 세션과
              다른 세션이 합니다.
            </p>
          </section>
          <section aria-labelledby="wl-why" className="wl-why">
            <h2 id="wl-why" className="wl-k">
              평가 대상을 고른 기준
            </h2>
            <p className="lead">
              시가 정하고 시 예산으로 하는 10억 원 이상 사업
            </p>
            <ul>
              <li>
                국비·도비가 절반 넘는 국가 제도(기초연금·보육료 등)는 중앙
                사업으로 따로 봅니다
              </li>
              <li>국비 공모로 시가 짓는 시설은 넣었습니다</li>
              <li>공원 유지관리·청사 관리 같은 일상 운영비는 뺐습니다</li>
            </ul>
          </section>
        </div>

        <section aria-labelledby="wl-list" className="wl-sec">
          <div className="wl-sh">
            <h2 id="wl-list">
              사업 <span>{rows.length}</span>
            </h2>
            <span>
              {SORTS[search.sort ?? 'priority']} · 필터는 주소에 남아 그대로
              공유됩니다
            </span>
          </div>
          <Filters data={data} search={search} />
          <ItemList key={JSON.stringify(search)} rows={rows} />
        </section>

        <DeptSection items={items} orgId={org.id} search={search} />
      </div>
    </div>
  )
}

function dotDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${m}. ${d}.`
}

function StageStep({
  stage,
  count,
  search,
}: {
  stage: WorkStage
  count: number
  search: WorklistSearch
}) {
  const filter = (STAGE_FILTERS as ReadonlyArray<string>).includes(stage)
    ? (stage as WorklistSearch['stage'])
    : '작업 중'
  const on = search.stage === filter
  return (
    <Link
      to="."
      search={{ ...search, stage: on ? undefined : filter }}
      className="wl-step"
      data-tone={stageTone(stage)}
      data-zero={count === 0 || undefined}
      data-on={on || undefined}
      aria-current={(on && search.stage === stage) || undefined}
    >
      <b>{count}</b>
      <span>{stage}</span>
    </Link>
  )
}

function Filters({ data, search }: WorklistPageProps) {
  const { groups, unknown } = deptGroups(data.items)
  return (
    <form
      className="wl-filters"
      aria-label="필터"
      onSubmit={(e) => e.preventDefault()}
    >
      <FilterSelect
        id="wl-dept"
        label="부서"
        value={search.dept ?? ''}
        search={search}
        field="dept"
        options={[
          ['', `전체 (${groups.length}곳)`],
          ...groups.map((g) => [g.name, `${g.name} (${g.count})`] as const),
          ...(unknown ? [[NO_DEPT, `${NO_DEPT} (${unknown})`] as const] : []),
        ]}
      />
      <FilterSelect
        id="wl-stage-f"
        label="단계"
        value={search.stage ?? ''}
        search={search}
        field="stage"
        options={[['', '전체'], ...STAGE_FILTERS.map((s) => [s, s] as const)]}
      />
      <FilterSelect
        id="wl-sort"
        label="정렬"
        value={search.sort ?? 'priority'}
        search={search}
        field="sort"
        options={(Object.keys(SORTS) as Array<Sort>).map(
          (k) => [k, SORTS[k]] as const,
        )}
        wide
      />
    </form>
  )
}

interface FilterSelectProps {
  id: string
  label: string
  value: string
  search: WorklistSearch
  field: keyof WorklistSearch
  options: ReadonlyArray<readonly [string, string]>
  wide?: boolean
}

function FilterSelect({
  id,
  label,
  value,
  search,
  field,
  options,
  wide,
}: FilterSelectProps) {
  const setSearch = useSetSearch()
  return (
    <div className={wide ? 'wl-f end' : 'wl-f'}>
      <label className="wl-k" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) =>
          setSearch({ ...search, [field]: e.target.value || undefined })
        }
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

/** 필터 변경은 같은 주소의 검색 조건만 바꾼다 */
function useSetSearch() {
  const navigate = useNavigate()
  return (search: WorklistSearch) =>
    navigate({ to: '.', search, replace: true })
}

function ItemList({ rows }: { rows: ReadonlyArray<WorkItem> }) {
  const [limit, setLimit] = useState(PAGE)
  if (!rows.length)
    return (
      <p className="wl-empty">
        조건에 맞는 사업이 없습니다. 필터를 줄여 보세요.
      </p>
    )
  return (
    <>
      <div className="wl-head" aria-hidden="true">
        <span>진행</span>
        <span>사업 · 고른 이유</span>
        <span className="r">예산 · 집행</span>
        <span>단계</span>
        <span>판정 · 다음 일</span>
      </div>
      <ol className="wl-rows">
        {rows.slice(0, limit).map((i) => (
          <li key={i.id}>
            <Row item={i} />
          </li>
        ))}
      </ol>
      <p className="wl-foot">
        <span>
          진행 막대: 수집 → 분석 → 작성 → 검증 → 게시. 점선은 아직 시작하지 않은
          사업, 게시한 사업은 7개 축 링으로 바뀝니다. 집행률은 지방재정365
          조회일 기준이라 연말 전에는 낮을 수 있고, 낮다고 문제라는 뜻은
          아닙니다.
        </span>
        {rows.length > limit && (
          <button type="button" onClick={() => setLimit((n) => n + PAGE)}>
            {Math.min(PAGE, rows.length - limit)}개 더 보기
          </button>
        )}
      </p>
    </>
  )
}

function Row({ item: i }: { item: WorkItem }) {
  const rate = spentRate(i)
  const low = rate !== null && (i.budget?.amount ?? 0) >= BIG && rate < LOW_RATE
  const body = (
    <>
      {i.summary ? (
        <AxisRing axes={i.summary.axes} size={56} />
      ) : (
        <StageBar stage={i.stage} />
      )}
      <div className="wl-name">
        <p className="wl-k">
          {[
            i.departments.join(', ') || NO_DEPT,
            i.sector,
            `우선 ${PRIORITY[i.priority]}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <h3>{i.summary?.title ?? i.name}</h3>
        <p className="why">{i.summary?.verdict ?? i.priorityWhy}</p>
        <p className="path">programs/{i.id}</p>
      </div>
      <span className="wl-money">
        {i.budget ? (
          <>
            <b>{eok(i.budget.amount)}</b>
            <span className={low ? 'low' : undefined}>
              집행 {rate === null ? '—' : `${Math.round(rate * 100)}%`}
            </span>
          </>
        ) : (
          <span>예산 줄 없음</span>
        )}
      </span>
      <span className="wl-stagecell">
        <span className="wl-stage" data-tone={stageTone(i.stage)}>
          {i.stage}
        </span>
        <span className="sub">
          {i.latestReport
            ? `${dotDate(i.latestReport)} 판`
            : `자료 ${i.materials} · 사실 ${i.facts}${i.absences ? ` · 부재 ${i.absences}` : ''}`}
        </span>
      </span>
      <span className="wl-next">
        {i.summary ? (
          <>
            <span>
              <StatusBadge status={summarize(i.summary).overall} overall />
            </span>
            {i.summary.nextDates[0] && (
              <span>
                다음 <b>{i.summary.nextDates[0].when}</b>{' '}
                {i.summary.nextDates[0].what}
              </span>
            )}
          </>
        ) : (
          NEXT_STEP[i.stage]
        )}
      </span>
    </>
  )
  return i.summary ? (
    <Link
      className="wl-row"
      to="/programs/$programId"
      params={{ programId: i.id }}
    >
      {body}
    </Link>
  ) : (
    <div className="wl-row">{body}</div>
  )
}

/** 진행 막대. 대기는 점선 테두리 하나, 고침은 마지막 칸을 황토로 */
function StageBar({ stage }: { stage: WorkStage }) {
  const filled = BAR_STEPS[stage]
  const label =
    stage === '대기' ? '진행: 대기, 아직 시작하지 않음' : `진행: ${stage}`
  return (
    <svg
      className="wl-bar"
      width="56"
      height="56"
      viewBox="0 0 56 56"
      role="img"
      aria-label={label}
    >
      {stage === '대기' ? (
        <rect x="2" y="24" width="52" height="8" rx="4" className="dash" />
      ) : (
        [0, 1, 2, 3, 4, 5].map((k) => (
          <rect
            key={k}
            x={2 + k * 9}
            y="24"
            width="7"
            height="8"
            rx="2"
            className={
              k < filled
                ? stage === '고침' && k === filled - 1
                  ? 'fix'
                  : stageTone(stage) === 'done'
                    ? 'done'
                    : 'on'
                : 'off'
            }
          />
        ))
      )}
    </svg>
  )
}

function DeptSection({
  items,
  orgId,
  search,
}: {
  items: ReadonlyArray<WorkItem>
  orgId: string
  search: WorklistSearch
}) {
  const [all, setAll] = useState(false)
  const { groups, unknown } = deptGroups(items)
  if (!groups.length) return null
  const shown = all ? groups : groups.slice(0, DEPT_PAGE)
  return (
    <section aria-labelledby="wl-dept" className="wl-sec">
      <div className="wl-sh">
        <h2 id="wl-dept">부서별</h2>
        <span>사업이 많은 부서 순 · 누르면 그 부서 사업만</span>
      </div>
      <ul className="wl-depts">
        {shown.map((g) => (
          <li key={g.name}>
            <DeptCard group={g} orgId={orgId} search={search} />
          </li>
        ))}
        {!all && groups.length > DEPT_PAGE && (
          <li>
            <button
              type="button"
              className="wl-dept more"
              onClick={() => setAll(true)}
            >
              부서 {groups.length - DEPT_PAGE}곳 더 보기
              {unknown > 0 && (
                <span>
                  {NO_DEPT} {unknown}개
                </span>
              )}
            </button>
          </li>
        )}
      </ul>
    </section>
  )
}

function DeptCard({
  group: g,
  orgId,
  search,
}: {
  group: DeptGroup
  orgId: string
  search: WorklistSearch
}) {
  const parts = WORK_STAGES.filter((s) => g.stages[s] > 0)
  return (
    <Link
      to="/orgs/$orgId/programs"
      params={{ orgId }}
      search={{ ...search, dept: g.name }}
      className="wl-dept"
      aria-current={search.dept === g.name || undefined}
    >
      <span className="top">
        <b>{g.name}</b>
        <span>사업 {g.count}</span>
      </span>
      <span
        className="wl-mini"
        role="img"
        aria-label={parts.map((s) => `${s} ${g.stages[s]}`).join(', ')}
      >
        {parts.map((s) => (
          <span
            key={s}
            data-tone={stageTone(s)}
            style={{ flexGrow: g.stages[s] }}
          />
        ))}
      </span>
      <span className="sub">
        {parts.map((s) => `${s} ${g.stages[s]}`).join(' · ')} · {eok(g.amount)}
      </span>
    </Link>
  )
}
