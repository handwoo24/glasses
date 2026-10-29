// 업체 리포트 한 장(업체 평가 체계 v0.1). 사업 리포트와 같은 뉴스형 한 페이지:
// 이름 → 판정·다음 판단 시점 → 6개 축 요약과 판정 이유 → 맡은 일 → 축별 근거(무거운 판정부터) → 출처.
// 판정 카드에는 판정과 근거 수준만 둔다. 설명은 바로 아래 축 요약이 맡는다.
import type { ReactNode } from 'react'
import {
  EVIDENCE_INFO,
  STATUS_INFO,
  overallEvidence,
} from '#/features/reports/axes'
import type { AxisStatus } from '#/features/reports/axes'
import { STATUS_TONE } from '#/features/reports/assessment'
import { CiteProvider } from '#/features/reports/components/cite'
import {
  renderFigure,
  renderInline,
  renderPanel,
} from '#/features/reports/doc/rich'
import type { AxisDoc } from '#/features/reports/report-doc'
import {
  ChecksFold,
  DisclosureFold,
  TimelineFold,
} from '#/features/reports/view/details'
import {
  ActionsBlock,
  SourceList,
  UnknownList,
} from '#/features/reports/view/doc-sections'
import type { Backlink } from '#/features/reports/view/doc-sections'
import {
  AxisFactList,
  CitedText,
  Fold,
  StatusBadge,
} from '#/features/reports/view/parts'
import {
  NextTimeline,
  VerdictStrip,
} from '#/features/reports/view/verdict-band'
import { useOpenDetailsOnHash } from '#/features/reports/view/use-open-details-on-hash'
import {
  OWNER_LABEL,
  VENDOR_AXES,
  VENDOR_AXIS_IDS,
  VENDOR_AXIS_INFO,
  VENDOR_OVERALL_RULES,
  vendorOverallStatus,
  vendorVerdictReason,
} from '../axes'
import type { VendorAxisId } from '../axes'
import type { VendorReportDoc } from '../vendor-doc'

const AXES_VERSION = '0.1'

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
  body: ReactNode
}

function judge(K: VendorReportDoc) {
  const statuses = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, K.axes[a].status]),
  ) as Record<VendorAxisId, AxisStatus>
  const levels = Object.fromEntries(
    VENDOR_AXIS_IDS.map((a) => [a, K.axes[a].evidence]),
  ) as Record<VendorAxisId, AxisDoc['evidence']>
  return {
    statuses,
    levels,
    overall: vendorOverallStatus(statuses, levels),
    evidence: overallEvidence(Object.values(levels)),
    reason: vendorVerdictReason(statuses, levels),
  }
}

export function VendorReportPage({ doc: K }: { doc: VendorReportDoc }) {
  useOpenDetailsOnHash()
  const j = judge(K)
  const sections = buildSections(K)
  return (
    <CiteProvider sources={K.sources}>
      <div className="page">
        <div className="rp">
          <Hero doc={K} />
          <div className="vb">
            <VerdictStrip overall={j.overall} evidence={j.evidence} />
            <NextTimeline dates={K.nextDates} nextReview={K.nextReview} />
          </div>
          <section className="vr-axes" aria-labelledby="t-vaxes">
            <h2 id="t-vaxes" className="label">
              6개 축 · 계약의 일생에 놓고 보기
            </h2>
            <ol>
              {VENDOR_AXIS_IDS.map((a) => {
                const x = K.axes[a]
                const info = VENDOR_AXIS_INFO[a]
                return (
                  <li key={a} className={STATUS_TONE[x.status]}>
                    <a href={`#axis-${a}`}>
                      <span className="nm">
                        {info.no} {info.label}
                      </span>
                      <i className="bar" aria-hidden="true" />
                      <span className="line">{x.line}</span>
                      <span className="who">
                        {OWNER_LABEL[info.owner]} ·{' '}
                        {STATUS_INFO[x.status].label} ·{' '}
                        <span
                          className={x.evidence === 'thin' ? 'thin' : undefined}
                        >
                          근거 {EVIDENCE_INFO[x.evidence].label}
                        </span>
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
            <p className="why">
              <b>판정 이유</b> {j.reason} <a href="#fold-method">판정 규칙</a>
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
          </div>
        </div>
      </div>
    </CiteProvider>
  )
}

function buildSections(K: VendorReportDoc): Array<PageSection> {
  const sections: Array<PageSection> = [
    { id: 'work', title: '맡은 일', body: renderPanel(K.work.body, '맡은 일') },
  ]
  if (K.life)
    sections.push({
      id: 'life',
      title: '계약의 일생',
      body: renderPanel(K.life.body, '계약의 일생'),
    })
  for (const [status, id, title] of AXIS_GROUPS) {
    const ids = VENDOR_AXIS_IDS.filter((a) => K.axes[a].status === status)
    if (ids.length)
      sections.push({
        id,
        title,
        body: ids.map((a) => <AxisArticle key={a} id={a} axis={K.axes[a]} />),
      })
  }
  if (K.context)
    sections.push({
      id: 'ctx',
      title: '다른 공공 계약',
      body: renderPanel(K.context.body, '다른 공공 계약'),
    })
  sections.push(
    {
      id: 'unk',
      title: '아직 확인하지 못한 것',
      body: <UnknownList unknowns={K.unknowns} />,
    },
    {
      id: 'act',
      title: '더 알아보는 방법',
      body: (
        <ActionsBlock
          request={K.request}
          moreActions={K.moreActions}
          requestTo="계약을 맡긴 기관"
        />
      ),
    },
    {
      id: 'more',
      title: '자세히 보기',
      body: (
        <div className="rp-folds">
          <ChecksFold
            checks={K.checks}
            signals={K.signals}
            axes={K.axes}
            set={VENDOR_AXES}
          />
          <MethodFold doc={K} />
          {K.disclosure.length > 0 && <DisclosureFold items={K.disclosure} />}
          <TimelineFold items={K.timeline} />
        </div>
      ),
    },
    {
      id: 'src',
      title: `출처 ${K.sources.length}건`,
      body: (
        <SourceList
          sources={K.sources}
          footNote={K.footNote}
          backlinks={backlinks(K)}
        />
      ),
    },
  )
  return sections
}

function Hero({ doc: K }: { doc: VendorReportDoc }) {
  return (
    <header className="rp-hero">
      <p className="chips">
        <a className="chip on" href={`/${K.program}`}>
          {K.project}
        </a>
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
        <div>
          <dt>사업자등록번호</dt>
          <dd>{K.bizno}</dd>
        </div>
      </dl>
      <p className="rp-meta">
        <span>
          자료 기준 <b>{K.asOf}</b>
        </span>
        <span>다음 갱신 {K.nextReview}</span>
        <span>출처 {K.sources.length}건 · 원문 대조</span>
        <span>업체 평가 체계 v{AXES_VERSION}</span>
      </p>
    </header>
  )
}

function AxisArticle({ id, axis: x }: { id: VendorAxisId; axis: AxisDoc }) {
  const info = VENDOR_AXIS_INFO[id]
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
          <i aria-hidden="true">{ev.dots}</i> · {OWNER_LABEL[info.owner]}의 몫
        </span>
        <span className="ax-q">{info.question}</span>
      </div>
      <h3 id={`t-axis-${id}`}>{x.title}</h3>
      {x.facts && <AxisFactList facts={x.facts} />}
      {x.figure && (
        <div className="rp-fig">{renderFigure(x.figure, info.label)}</div>
      )}
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

function MethodFold({ doc: K }: { doc: VendorReportDoc }) {
  return (
    <Fold
      id="fold-method"
      title="판정 방법"
      summary={`업체 평가 체계 v${AXES_VERSION}`}
    >
      <p>
        업체가 이 사업에서 맡은 계약을 약속대로 해냈는지를 봅니다. 회사의
        평판이나 사람은 평가하지 않습니다. 축마다 누구의 몫인지 나눠, 발주기관이
        정한 것으로 업체를 깎지 않습니다.
      </p>
      <h4>6개 축</h4>
      <ul className="rows">
        {VENDOR_AXIS_IDS.map((a) => (
          <li key={a}>
            <p className="q">
              {VENDOR_AXES.name(a)} · {OWNER_LABEL[VENDOR_AXIS_INFO[a].owner]}의
              몫
            </p>
            <p>
              {VENDOR_AXIS_INFO[a].question}
              {K.axisIndicators[a] && ` 본 것: ${K.axisIndicators[a]}`}
            </p>
          </li>
        ))}
      </ul>
      <h4>종합 판정 규칙 (위에서부터 처음 해당하는 것)</h4>
      <ol className="rules">
        {VENDOR_OVERALL_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </Fold>
  )
}

/** 출처 id마다 그 출처를 인용한 축 */
function backlinks(K: VendorReportDoc): Map<string, Array<Backlink>> {
  const map = new Map<string, Array<Backlink>>()
  for (const a of VENDOR_AXIS_IDS) {
    const x = K.axes[a]
    const ids = new Set(
      [...(x.facts ?? []).map((f) => f.cited), ...(x.said ?? [])].flatMap(
        ([, ...cite]) => cite,
      ),
    )
    const link = {
      href: `#axis-${a}`,
      mark: VENDOR_AXIS_INFO[a].no,
      label: VENDOR_AXIS_INFO[a].label,
    }
    for (const id of ids) map.set(id, [...(map.get(id) ?? []), link])
  }
  return map
}
