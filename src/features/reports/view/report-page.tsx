// 리포트 한 장(평가 체계 v0.1). 뉴스형 한 페이지: 이름 → 판정·다음 판단 시점 → 핵심 내용 → 7개 축 흐름
// → 번호 붙은 구역(무거운 판정부터) → 출처. 넓은 화면은 오른쪽 목차가 따라온다.
import type { ReactNode } from 'react'
import {
  AXES_VERSION,
  AXIS_IDS,
  AXIS_INFO,
  EVIDENCE_INFO,
  STATUS_INFO,
} from '../axes'
import type { AxisId, AxisStatus } from '../axes'
import { STATUS_TONE, summarize, verdictReason } from '../assessment'
import { Cite, CiteProvider, citeKind, useCiteEntry } from '../components/cite'
import { formatDate } from '../format'
import {
  labelledItem,
  renderFigure,
  renderInline,
  renderPanel,
} from '../doc/rich'
import type { AxisDoc, ReportDoc } from '../report-doc'
import type { Source } from '../schema'
import { AxisFlow } from './axis-flow'
import type { FlowKind } from './axis-flow'
import {
  BudgetBasisFold,
  ChecksFold,
  ContractsFold,
  DisclosureFold,
  MethodFold,
  OversightFold,
  TimelineFold,
} from './details'
import {
  AxisFactList,
  CitedText,
  DDay,
  OverallEvidenceMark,
  StatusBadge,
} from './parts'
import { RequestBox } from './request-box'
import { useOpenDetailsOnHash } from './use-open-details-on-hash'

type Summary = ReturnType<typeof summarize>

/** 축별 근거를 무거운 판정부터 묶는다 */
const AXIS_GROUPS: ReadonlyArray<readonly [AxisStatus, string, string]> = [
  ['fix', 'fix', '개선이 필요한 점'],
  ['watch', 'watch', '지켜볼 점'],
  ['on-track', 'good', '잘 되고 있는 점'],
  ['unknown', 'unknown', '아직 판단할 수 없는 것'],
]

interface PageSection {
  id: string
  title: string
  /** 목차에 붙는 개수 */
  count?: number
  tone?: AxisStatus
  body: ReactNode
}

export function ReportPage({ doc: K }: { doc: ReportDoc }) {
  useOpenDetailsOnHash()
  const summary = summarize(K)
  const kind: FlowKind = K.subject?.startsWith('orgs/') ? 'budget' : 'program'
  const sections = buildSections(K, kind)

  return (
    <CiteProvider sources={K.sources}>
      <div className="page">
        <div className="rp">
          <Hero doc={K} />
          <div className="rp-top">
            <VerdictCard doc={K} summary={summary} />
            <NextCard doc={K} />
          </div>
          <KeyPoints axes={K.axes} />
          <section className="rp-flow" aria-labelledby="t-flow">
            <div className="rp-mini-h">
              <h2 id="t-flow" className="label">
                7개 축 · {kind === 'budget' ? '예산' : '사업'}의 흐름에 놓고
                보기
              </h2>
              <a href="/method">축과 판정 규칙</a>
            </div>
            <AxisFlow axes={K.axes} kind={kind} />
            <p className="cap">
              실선 테두리는 판정이 난 축, 점선은 자료가 없어 판단하지 못한
              축입니다. 칸을 누르면 그 축의 근거로 갑니다.
            </p>
          </section>
          <div className="rp-body">
            <div className="rp-main">
              {sections.map((s, i) => (
                <section
                  key={s.id}
                  className="rp-sec"
                  id={s.id}
                  aria-labelledby={`t-${s.id}`}
                >
                  <div className="rp-sh">
                    <span className="no">{String(i + 1).padStart(2, '0')}</span>
                    <h2 id={`t-${s.id}`}>{s.title}</h2>
                  </div>
                  {s.body}
                </section>
              ))}
            </div>
            <Rail doc={K} summary={summary} sections={sections} />
          </div>
        </div>
      </div>
    </CiteProvider>
  )
}

function buildSections(K: ReportDoc, kind: FlowKind): Array<PageSection> {
  const sections: Array<PageSection> = [
    {
      id: 'ov',
      title: kind === 'budget' ? '개요' : '사업 개요',
      body: <Overview overview={K.overview} />,
    },
    {
      id: 'use',
      title: K.side.title,
      body: renderPanel(K.side.body, K.side.title),
    },
    {
      id: 'out',
      title: K.status.title,
      body: renderPanel(K.status.body, K.status.title),
    },
  ]
  for (const [status, id, title] of AXIS_GROUPS) {
    const ids = AXIS_IDS.filter((a) => K.axes[a].status === status)
    if (ids.length === 0) continue
    sections.push({
      id,
      title,
      count: ids.length,
      tone: status,
      body: ids.map((a) => <AxisArticle key={a} id={a} axis={K.axes[a]} />),
    })
  }
  if (K.vendors)
    sections.push({
      id: 'ven',
      title: K.vendors.title,
      body: renderPanel(K.vendors.body, K.vendors.title),
    })
  sections.push(
    {
      id: 'unk',
      title: '아직 확인하지 못한 것',
      body: <Unknowns doc={K} />,
    },
    { id: 'act', title: '더 알아보는 방법', body: <Actions doc={K} /> },
    { id: 'more', title: '자세히 보기', body: <Details doc={K} /> },
    {
      id: 'src',
      title: `출처 ${K.sources.length}건`,
      body: <Sources doc={K} />,
    },
  )
  return sections
}

function Hero({ doc: K }: { doc: ReportDoc }) {
  return (
    <header className="rp-hero">
      <p className="chips">
        <span className="chip on">{K.project}</span>
      </p>
      <h1>{K.title}</h1>
      <p className="rp-lede">
        <CitedText value={K.lede} />
      </p>
      <dl className="rp-facts">
        {K.facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="rp-meta">
        <span>
          자료 기준 <b>{K.asOf}</b>
        </span>
        <span>다음 갱신 {K.nextReview}</span>
        <span>출처 {K.sources.length}건 · 원문 대조</span>
        <span>평가 체계 v{AXES_VERSION}</span>
      </p>
    </header>
  )
}

const METER: ReadonlyArray<AxisStatus> = ['on-track', 'watch', 'fix']

function VerdictCard({
  doc: K,
  summary,
}: {
  doc: ReportDoc
  summary: Summary
}) {
  const { overall, evidence, statuses, levels } = summary
  const tone = STATUS_TONE[overall]
  return (
    <section
      className={`rp-verdict ${tone}`}
      id="verdict"
      aria-labelledby="t-verdict"
    >
      <div className="top">
        <h2 id="t-verdict" className="label">
          종합 판정
        </h2>
        <OverallEvidenceMark level={evidence} />
      </div>
      <div className="mid">
        <p className="big">{STATUS_INFO[overall].overall}</p>
        <div
          className="meter"
          role="img"
          aria-label={`판정 미터: 순항, 지켜볼 점 있음, 개선 필요 가운데 ${STATUS_INFO[overall].overall}`}
        >
          {METER.map((s) => (
            <span key={s} className={s === overall ? 'on' : undefined}>
              <i />
              {STATUS_INFO[s].overall}
            </span>
          ))}
        </div>
      </div>
      <p className="sentence">{K.verdict}</p>
      <p className="why">
        <b>판정 이유</b> {verdictReason(statuses, levels)}{' '}
        <a href="#fold-method">판정 규칙</a>
      </p>
    </section>
  )
}

function NextCard({ doc: K }: { doc: ReportDoc }) {
  const first = K.nextDates.at(0)
  const rest = K.nextDates.slice(1)
  return (
    <section className="rp-next" aria-labelledby="t-next">
      <h2 id="t-next" className="label">
        다음 판단 시점
      </h2>
      {first && (
        <>
          <p className="big">
            {first.when} <DDay date={first.date} />
          </p>
          <p className="what">{first.what}</p>
        </>
      )}
      {rest.length > 0 && (
        <ol>
          {rest.map((d, i) => (
            <li key={`${i}-${d.when}`}>
              <b>{d.when}</b> {d.what}
            </li>
          ))}
        </ol>
      )}
      <p className="foot">다음 갱신 예정 {K.nextReview}</p>
    </section>
  )
}

/** 핵심 내용: 무거운 판정의 축 결론부터 세 개 */
function KeyPoints({ axes }: { axes: Record<AxisId, AxisDoc> }) {
  const order: ReadonlyArray<AxisStatus> = ['fix', 'watch', 'unknown']
  const picked = order
    .flatMap((s) => AXIS_IDS.filter((a) => axes[a].status === s))
    .slice(0, 3)
  if (picked.length === 0) return null
  return (
    <section className="rp-key" aria-labelledby="t-key">
      <h2 id="t-key" className="label">
        핵심 내용
      </h2>
      <ol>
        {picked.map((a) => {
          const x = axes[a]
          return (
            <li key={a} className={STATUS_TONE[x.status]}>
              <a href={`#axis-${a}`}>
                <b>{x.title}</b>
                <span>
                  {AXIS_INFO[a].no} {AXIS_INFO[a].label} ·{' '}
                  {STATUS_INFO[x.status].label} · 근거{' '}
                  {EVIDENCE_INFO[x.evidence].label}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function AxisArticle({ id, axis: x }: { id: AxisId; axis: AxisDoc }) {
  const info = AXIS_INFO[id]
  const ev = EVIDENCE_INFO[x.evidence]
  return (
    <article
      className="rp-axis"
      id={`axis-${id}`}
      aria-labelledby={`t-axis-${id}`}
    >
      <div className="head">
        <StatusBadge status={x.status} />
        <span className="label">
          {info.no} {info.label} · 근거 {ev.label}{' '}
          <i aria-hidden="true">{ev.dots}</i>
        </span>
        <span className="ax-q">{info.question}</span>
      </div>
      <h3 id={`t-axis-${id}`}>{x.title}</h3>
      {x.facts && <AxisFactList facts={x.facts} />}
      {x.figure && (
        <div className="rp-fig">{renderFigure(x.figure, info.label)}</div>
      )}
      {x.per && <p className="per">{x.per}</p>}
      {x.said && (
        <div className="said">
          <p className="label">기관의 설명</p>
          {x.said.map((s, i) => (
            <p key={`${i}-${s[0]}`} className="q">
              <CitedText value={s} />
            </p>
          ))}
        </div>
      )}
      {x.note && (
        <p className="note">
          <b className="label">참고</b> {renderInline(x.note, '참고')}
        </p>
      )}
      {x.missing && (
        <p className="missing">
          <b className="label">확인 못 한 것</b> <span>{x.missing}</span>
        </p>
      )}
    </article>
  )
}

function Overview({ overview }: { overview: ReportDoc['overview'] }) {
  return (
    <>
      <div className="ov-cells">
        {overview.cells.map((c) => (
          <div key={c.label}>
            <span className="label">{c.label}</span>
            <span className="num">{c.value}</span>
            <span>
              {c.text}
              <Cite ids={c.cite} />
            </span>
          </div>
        ))}
      </div>
      {overview.chips && (
        <>
          <p className="label">
            {overview.chips.label}
            <Cite ids={overview.chips.cite} />
          </p>
          <ul className="chips">
            {overview.chips.items.map((c) => (
              <li key={c.label} className={c.on ? 'on' : undefined}>
                {c.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function Unknowns({ doc: K }: { doc: ReportDoc }) {
  return (
    <ul className="list">
      {K.unknowns.map((u, i) => (
        <li key={`${i}-${u.text}`}>
          <span className={u.requested ? 'k req' : 'k'}>{u.label}</span>
          <span>
            {u.text}
            <Cite ids={u.cite} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Actions({ doc: K }: { doc: ReportDoc }) {
  return (
    <div className="rp-act">
      <div className="request">
        <p className="label">정보공개청구 문구</p>
        <RequestBox text={K.request} />
        <p className="cap">
          <ExternalLink href="https://www.open.go.kr/">
            정보공개포털
          </ExternalLink>
          에서 이 사업을 맡은 기관을 고르고 문구를 붙이면 됩니다.
        </p>
      </div>
      <ul className="list">
        {K.moreActions.map((it, i) => labelledItem(it, '그 밖의 방법', i))}
        <li>
          <span className="k">질의</span>
          <span>
            <ExternalLink href="https://www.epeople.go.kr/">
              국민신문고
            </ExternalLink>
            로 기관에 직접 물을 수 있습니다.
          </span>
        </li>
      </ul>
    </div>
  )
}

function Details({ doc: K }: { doc: ReportDoc }) {
  return (
    <div className="rp-folds">
      <ChecksFold checks={K.checks} signals={K.signals} axes={K.axes} />
      <MethodFold typeNote={K.typeNote} indicators={K.axisIndicators} />
      {K.budgetBasis && <BudgetBasisFold basis={K.budgetBasis} />}
      {K.contracts && <ContractsFold contracts={K.contracts} />}
      {K.oversight.length > 0 && <OversightFold items={K.oversight} />}
      {K.disclosure.length > 0 && <DisclosureFold items={K.disclosure} />}
      <TimelineFold items={K.timeline} />
    </div>
  )
}

/** 출처 id마다 그 출처를 인용한 축 */
function citedAxes(axes: Record<AxisId, AxisDoc>): Map<string, Array<AxisId>> {
  const map = new Map<string, Array<AxisId>>()
  for (const a of AXIS_IDS) {
    const ids = new Set(
      [
        ...(axes[a].facts ?? []).map((f) => f.cited),
        ...(axes[a].said ?? []),
      ].flatMap(([, ...cite]) => cite),
    )
    for (const id of ids) map.set(id, [...(map.get(id) ?? []), a])
  }
  return map
}

function Sources({ doc: K }: { doc: ReportDoc }) {
  const backlinks = citedAxes(K.axes)
  const kinds = new Map<string, number>()
  for (const s of K.sources)
    kinds.set(citeKind(s), (kinds.get(citeKind(s)) ?? 0) + 1)
  const byCount = [...kinds].sort((a, b) => b[1] - a[1])
  return (
    <>
      <div
        className="src-kinds"
        role="img"
        aria-label={`출처 종류: ${byCount.map(([k, n]) => `${k} ${n}`).join(', ')}`}
      >
        {byCount.map(([k, n], i) => (
          <span
            key={k}
            className={`k${Math.min(i, 4)}`}
            style={{ flexGrow: n }}
          >
            {k} {n}
          </span>
        ))}
      </div>
      <ol className="srcs">
        {K.sources.map((s) => (
          <SourceItem key={s.id} source={s} axes={backlinks.get(s.id) ?? []} />
        ))}
      </ol>
      <p className="foot-note">
        {K.footNote} 초안은 AI(Claude)가 쓰고 숫자와 인용은 원문과 대조했습니다.
        틀린 내용은 알려 주세요.
      </p>
    </>
  )
}

function SourceItem({
  source: s,
  axes,
}: {
  source: Source
  axes: ReadonlyArray<AxisId>
}) {
  const { n, label } = useCiteEntry(s.id)
  return (
    <li id={`src-${n}`}>
      <span className="cite">
        {label} {n}
      </span>
      <span className="body">
        <ExternalLink href={s.url}>{s.title}</ExternalLink>
        <small>
          {s.org} · {formatDate(s.date)}
          {s.locator && ` · ${s.locator}`} · {s.license}
        </small>
      </span>
      {axes.length > 0 && (
        <span className="used">
          인용{' '}
          {axes.map((a) => (
            <a key={a} href={`#axis-${a}`} aria-label={AXIS_INFO[a].label}>
              {AXIS_INFO[a].no}
            </a>
          ))}
        </span>
      )}
    </li>
  )
}

function Rail({
  doc: K,
  summary,
  sections,
}: {
  doc: ReportDoc
  summary: Summary
  sections: ReadonlyArray<PageSection>
}) {
  const first = K.nextDates.at(0)
  return (
    <aside className="rp-rail" aria-label="이 페이지">
      <div className="mini">
        <p className="label">{K.title}</p>
        <p>
          <StatusBadge status={summary.overall} overall />
        </p>
        {first && (
          <p className="next">
            다음 판단 <b>{first.when}</b> <DDay date={first.date} />
          </p>
        )}
      </div>
      <nav aria-label="목차">
        <ol>
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                <span className="no">{String(i + 1).padStart(2, '0')}</span>{' '}
                {s.title}
                {s.count !== undefined && s.tone && (
                  <span className={`n ${STATUS_TONE[s.tone]}`}> {s.count}</span>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  )
}

export function ExternalLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
