// 공공사업 리포트 한 장(평가 체계 v0.1). 휴대폰은 카드, 넓은 화면은 한 장 요약 격자.
// 섹션 순서와 문장 규칙은 glasses 문서 작성 체계를 따른다.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { AXES_VERSION, AXIS_IDS, AXIS_INFO, STATUS_INFO } from '../axes'
import type { AxisId } from '../axes'
import {
  STATUS_TONE,
  allSources,
  classifyChecks,
  overallReason,
  signalsByAxis,
  summarize,
} from '../assessment'
import type { Assessment, AxisAssessment } from '../assessment'
import { Cite, CiteProvider } from '../components/cite'
import { formatDate } from '../format'
import type { Report, Source } from '../schema'
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
  CitedText,
  Evidence,
  FactList,
  OverallEvidenceMark,
  Panel,
  StatusBadge,
} from './parts'
import { RequestBox } from './request-box'
import { useOpenDetailsOnHash } from './use-open-details-on-hash'

interface ReportPageProps {
  report: Report
  assessment: Assessment
}

export function ReportPage({ report: R, assessment: K }: ReportPageProps) {
  useOpenDetailsOnHash()
  const sources = useMemo(() => allSources(R, K), [R, K])
  const sourceIds = useMemo(() => sources.map((s) => s.id), [sources])
  const summary = summarize(K)
  const checks = classifyChecks(R, K)
  const signals = signalsByAxis(R, K)

  return (
    <CiteProvider sourceIds={sourceIds}>
      <div className="page">
        <article className="sheet">
          <Head assessment={K} summary={summary} />
          <Panel id="ov" title="사업 개요">
            <Overview overview={K.overview} />
          </Panel>
          <Panel id="use" title={K.side.title}>
            {K.side.body}
          </Panel>
          <VerdictBlock assessment={K} summary={summary} />
          <Panel id="out" title={K.status.title}>
            {K.status.body}
          </Panel>
          <section className="panel axes-block" aria-labelledby="t-axes">
            <div className="band">
              <span id="t-axes">축별 근거</span>
            </div>
            <ol className="pts">
              {AXIS_IDS.map((a, i) => (
                <AxisPoint key={a} id={a} index={i} axis={K.axes[a]} />
              ))}
            </ol>
          </section>
          {K.vendors && (
            <Panel id="ven" title={K.vendors.title}>
              {K.vendors.body}
            </Panel>
          )}
          <Panel id="unk" title="아직 확인하지 못한 것">
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
            <p className="foot-note">다음 갱신 예정: {K.nextReview}</p>
          </Panel>
          <Panel id="act" title="더 알아보는 방법">
            <ul className="list">
              <li>
                <span className="k">정보공개청구</span>
                <span>
                  <ExternalLink href="https://www.open.go.kr/">
                    정보공개포털
                  </ExternalLink>
                  에서 기관 ‘경기도 고양시’를 고르고 아래 문구를 붙이면 됩니다.
                </span>
                <RequestBox text={K.request} />
              </li>
              {K.moreActions}
              <li>
                <span className="k">질의</span>
                <span>
                  <ExternalLink href="https://www.epeople.go.kr/">
                    국민신문고
                  </ExternalLink>
                  로 시에 직접 물을 수 있습니다.
                </span>
              </li>
            </ul>
          </Panel>
          <Panel id="more" title="자세히 보기">
            <ChecksFold checks={checks} signals={signals} axes={K.axes} />
            <MethodFold typeNote={K.typeNote} indicators={K.axisIndicators} />
            {R.budgetBasis && <BudgetBasisFold basis={R.budgetBasis} />}
            {R.contracts && <ContractsFold contracts={R.contracts} />}
            {R.oversight.length > 0 && <OversightFold items={R.oversight} />}
            {R.disclosure.length > 0 && <DisclosureFold items={R.disclosure} />}
            <TimelineFold items={R.timeline} />
          </Panel>
          <Panel id="src" title="출처">
            <SourceList sources={sources} />
            <p className="foot-note">
              {K.footNote} 초안은 AI(Claude)가 쓰고 숫자와 인용은 원문과
              대조했습니다. 틀린 내용은 알려 주세요.
            </p>
          </Panel>
        </article>
      </div>
    </CiteProvider>
  )
}

type Summary = ReturnType<typeof summarize>

function Head({
  assessment: K,
  summary,
}: {
  assessment: Assessment
  summary: Summary
}) {
  return (
    <section className="panel" id="head" aria-labelledby="t-head">
      <div className="band">
        <span>사업 정보</span>
      </div>
      <div className="inner">
        <p className="proj">{K.project}</p>
        <h1 id="t-head">{K.title}</h1>
        <p className="facts-row">
          {[...K.facts, ['기준', K.asOf] as const].map(([k, v]) => (
            <span key={k}>
              <b>{k}</b>
              {v}
            </span>
          ))}
        </p>
        <p className="lede">
          <CitedText value={K.lede} />
        </p>
        <a className="mini-verdict" href="#verdict">
          <span className="label">종합 판정</span>
          <StatusBadge status={summary.overall} overall size="lg" />
          <OverallEvidenceMark level={summary.evidence} />
          <span className="go">자세히</span>
        </a>
      </div>
    </section>
  )
}

function Overview({ overview }: { overview: Assessment['overview'] }) {
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

function VerdictBlock({
  assessment: K,
  summary: { overall, evidence, fixCount },
}: {
  assessment: Assessment
  summary: Summary
}) {
  return (
    <section
      className={`panel tone-${STATUS_TONE[overall]}`}
      id="verdict"
      aria-labelledby="t-verdict"
    >
      <div className="band">
        <span id="t-verdict">종합 판정</span>
      </div>
      <div className="inner">
        <div className="vb-top">
          <StatusBadge status={overall} overall size="xl" />
          <OverallEvidenceMark level={evidence} />
          <span className="ver">평가 체계 v{AXES_VERSION} (초안)</span>
        </div>
        <p className="vb-sentence">{K.verdict}</p>
        <ul className="vb-axes">
          {AXIS_IDS.map((a) => (
            <li key={a}>
              <a href={`#axis-${a}`} className="an">
                {AXIS_INFO[a].no} {AXIS_INFO[a].label}
              </a>
              <StatusBadge status={K.axes[a].status} />
              <Evidence level={K.axes[a].evidence} />
              <span className="ax">{K.axes[a].line}</span>
            </li>
          ))}
        </ul>
        <p className="vb-why">
          {overallReason(overall, fixCount)} 종합 판정 규칙에 따라 ‘
          {STATUS_INFO[overall].overall}’입니다. 시에 질의하기 전, 공개
          자료만으로 매겼습니다. <a href="#fold-method">판정 방법</a>
        </p>
        <p className="vb-next">
          <b>다음 판단 시점</b>
          {K.nextDates.map(([d, l], i) => (
            <span key={`${i}-${d}`}>
              <strong>{d}</strong> {l}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}

interface AxisPointProps {
  id: AxisId
  index: number
  axis: AxisAssessment
}

function AxisPoint({ id, index, axis: x }: AxisPointProps) {
  const info = AXIS_INFO[id]
  const notes: Array<[string, ReactNode]> = []
  if (x.said?.length)
    notes.push([
      '시의 설명',
      x.said.length === 1 ? (
        <CitedText value={x.said[0]} />
      ) : (
        x.said.map((s, i) => (
          <p key={`${i}-${s[0]}`}>
            <CitedText value={s} />
          </p>
        ))
      ),
    ])
  if (x.note) notes.push(['참고', x.note])
  if (x.missing) notes.push(['확인 못 한 것', x.missing])

  return (
    <li className="point" id={`axis-${id}`}>
      <div className="band">
        <span>
          {info.no} {info.label}
          {info.core && ' · 핵심 축'}
        </span>
        <span className="idx">
          {index + 1}/{AXIS_IDS.length}
        </span>
      </div>
      <div className="ax-top">
        <span className="ax-name">
          {info.no} {info.label}
        </span>
        <StatusBadge status={x.status} />
        <Evidence level={x.evidence} />
        <span className="ax-q">{info.question}</span>
      </div>
      <h3>{x.title}</h3>
      <div className="body">
        {x.facts && <FactList facts={x.facts} />}
        {x.figure}
        {x.per && <p className="per">{x.per}</p>}
        {notes.length > 0 && (
          <dl className="notes">
            {notes.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  )
}

function SourceList({ sources }: { sources: ReadonlyArray<Source> }) {
  return (
    <ol className="srcs">
      {sources.map((s, i) => (
        <li key={s.id} id={`src-${i + 1}`}>
          <span className="n">{i + 1}</span>
          <span>
            <ExternalLink href={s.url}>{s.title}</ExternalLink>
            <br />
            <small>
              {s.org} · {s.kind} · {formatDate(s.date)}
              {s.locator && ` · ${s.locator}`} · {s.license}
            </small>
          </span>
        </li>
      ))}
    </ol>
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
