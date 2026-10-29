// ‘자세히 보기’: 판정의 재료를 접어 둔다. 내용은 리포트 데이터(Report)에서 온다.
import { ANY_AXES, AXES_VERSION } from '../axes'
import type { AxisId, AxisSet, AxisStatus } from '../axes'
import { answerCounts } from '../assessment'
import type { ClassifiedCheck } from '../assessment'
import { Cite } from '../components/cite'
import { formatDate, formatWon } from '../format'
import {
  DISCLOSURE_LABEL as DISCLOSURE,
  OVERSIGHT_LABEL as OVERSIGHT,
  SEVERITY_LABEL as SEVERITY,
  SIGNAL_LABEL as SIGNAL,
} from '../labels'
import type { ReportDoc } from '../report-doc'
import type { Contract, RiskSignal } from '../schema'
import {
  AxisDefinitions,
  EVIDENCE_RULE_NOTE,
  EvidenceLegend,
  OverallRules,
  StatusLegend,
  THRESHOLD_NOTE,
} from './method-parts'
import { AnswerBadge, Fold, StatusBadge } from './parts'

interface ChecksFoldProps<TAxis extends string> {
  checks: ReadonlyArray<ClassifiedCheck<TAxis>>
  signals: Partial<Record<TAxis, ReadonlyArray<RiskSignal>>>
  axes: Record<TAxis, { status: AxisStatus }>
  /** 축 목록 (기본: 사업의 7개 축). 업체 리포트는 업체 축 */
  set?: AxisSet<TAxis>
}

export function ChecksFold<TAxis extends string = AxisId>({
  checks,
  signals,
  axes,
  set = ANY_AXES as unknown as AxisSet<TAxis>,
}: ChecksFoldProps<TAxis>) {
  const n = answerCounts(checks)
  return (
    <Fold
      id="fold-checks"
      title="점검표"
      summary={`${checks.length}개 항목 · 충족 ${n.yes} · 미충족 ${n.no} · 확인 필요 ${n.open} · 자료 없음 ${n.none}`}
    >
      <p className="crit">
        상태는 질문의 답입니다. 답이 ‘아니오’면 미충족이고, 왜 그런지는 ‘확인 못
        한 것’에 따로 적습니다. 위법 여부를 판단한 것이 아닙니다.
      </p>
      {set.ids.map((a) => {
        const rows = checks.filter((k) => k.axis === a)
        const sig: ReadonlyArray<RiskSignal> = signals[a] ?? []
        return (
          <div key={a}>
            <h4>
              {set.name(a)} <StatusBadge status={axes[a].status} />
            </h4>
            {rows.length > 0 ? (
              <ul className="chks">
                {rows.map((k, i) => (
                  <li className="chk" key={`${i}-${k.question}`}>
                    <AnswerBadge answer={k.answer} />
                    <div>
                      <p className="q">
                        {k.question}
                        <Cite ids={k.cite} />
                      </p>
                      <p>{k.finding}</p>
                      <p className="crit">
                        <b>판단 기준</b> {k.criterion}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="crit">이 축의 점검 항목은 아직 없습니다.</p>
            )}
            {sig.length > 0 && (
              <details className="sub">
                <summary>관련 지표 {sig.length}개</summary>
                <ul className="rows">
                  {sig.map((s, i) => (
                    <li key={`${i}-${s.signal}`}>
                      <p className="q">
                        {s.signal}{' '}
                        <span className="tag">
                          {SIGNAL[s.status]} · {SEVERITY[s.severity]}
                        </span>
                        <Cite ids={s.cite} />
                      </p>
                      <p>{s.detail}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )
      })}
    </Fold>
  )
}

interface MethodFoldProps {
  typeNote?: string
  indicators: ReportDoc['axisIndicators']
}

export function MethodFold({ typeNote, indicators }: MethodFoldProps) {
  return (
    <Fold
      id="fold-method"
      title="판정 방법"
      summary={`평가 체계 v${AXES_VERSION}`}
    >
      <p>
        사업을 평가하고, 사람과 의도는 평가하지 않습니다. 판정 기준은 기관이
        내놓은 사업계획서·예산서·공고문과 법령, 비슷한 사업의 실적입니다.
        {typeNote && ` ${typeNote}`}
      </p>
      <h4>7개 축</h4>
      <AxisDefinitions indicators={indicators} />
      <h4>상태 4단계</h4>
      <StatusLegend />
      <h4>근거 수준 3단계</h4>
      <EvidenceLegend />
      <h4>종합 판정 규칙 (위에서부터 처음 해당하는 것)</h4>
      <OverallRules />
      <p className="crit">
        {EVIDENCE_RULE_NOTE} {THRESHOLD_NOTE}
      </p>
    </Fold>
  )
}

export function BudgetBasisFold({
  basis,
}: {
  basis: NonNullable<ReportDoc['budgetBasis']>
}) {
  return (
    <Fold title="예산이 정해진 과정" summary={`${basis.steps.length}단계`}>
      <p>{basis.intro}</p>
      <ul className="rows">
        {basis.steps.map((s, i) => (
          <li key={`${i}-${s.label}`}>
            <p className="q">{s.label}</p>
            <p>
              {s.detail}
              <Cite ids={s.cite} />
            </p>
          </li>
        ))}
      </ul>
    </Fold>
  )
}

function contractRows(k: Contract): Array<[string, string]> {
  const paid = k.performance?.payments ?? []
  const rows: Array<[string, string] | false | undefined> = [
    ['업체', k.vendor],
    ['방식', k.method],
    ['계약일', formatDate(k.date)],
    k.period !== undefined && ['기간', k.period],
    k.baseAmount !== undefined && ['기초금액', formatWon(k.baseAmount)],
    k.awardAmount !== undefined && ['낙찰 금액', formatWon(k.awardAmount)],
    k.contractAmount !== undefined && [
      '계약 금액',
      formatWon(k.contractAmount),
    ],
    k.rate !== undefined && ['낙찰률', `${k.rate}%`],
    k.bid?.notice !== undefined && ['공고', k.bid.notice],
    k.bid?.eligibility !== undefined && ['참가 자격', k.bid.eligibility],
    k.bid?.evaluation !== undefined && ['평가 방식', k.bid.evaluation],
    k.performance?.supervisor !== undefined && [
      '감독 공무원',
      k.performance.supervisor ? '지정됨' : '지정 기록 없음',
    ],
    paid.length > 0 && [
      '지급',
      `${paid.length}회, 합계 ${formatWon(paid.reduce((s, p) => s + p.amount, 0))}`,
    ],
  ]
  return rows.filter((r): r is [string, string] => Boolean(r))
}

export function ContractsFold({
  contracts,
}: {
  contracts: NonNullable<ReportDoc['contracts']>
}) {
  return (
    <Fold title="계약 상세" summary={`${contracts.items.length}건`}>
      <div className="ctrs">
        {contracts.items.map((k, i) => (
          <article className="ctr" key={`${i}-${k.name}`}>
            <h4>
              {k.name}
              <Cite ids={k.cite} />
            </h4>
            {k.flag && (
              <p className="flag">
                <b>참고</b> {k.flag}
              </p>
            )}
            <dl>
              {contractRows(k).map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </Fold>
  )
}

export function OversightFold({ items }: { items: ReportDoc['oversight'] }) {
  return (
    <Fold title="감사·점검 이력" summary={`${items.length}건`}>
      <ul className="rows">
        {items.map((o, i) => (
          <li key={`${i}-${o.body}`}>
            <p className="q">
              {o.body}{' '}
              <span className="tag">
                {o.when} · {OVERSIGHT[o.status]}
              </span>
              <Cite ids={o.cite} />
            </p>
            <p>{o.finding}</p>
            <p className="crit">
              <b>그 뒤</b> {o.followUp}
            </p>
          </li>
        ))}
      </ul>
    </Fold>
  )
}

export function DisclosureFold({ items }: { items: ReportDoc['disclosure'] }) {
  return (
    <Fold title="공개 문서 현황" summary={`${items.length}건`}>
      <ul className="rows">
        {items.map((d, i) => (
          <li key={`${i}-${d.doc}`}>
            <p className="q">
              {d.doc} <span className="tag">{DISCLOSURE[d.status]}</span>
              <Cite ids={d.cite} />
            </p>
            <p>{d.note}</p>
          </li>
        ))}
      </ul>
    </Fold>
  )
}

export function TimelineFold({ items }: { items: ReportDoc['timeline'] }) {
  return (
    <Fold title="진행 경과" summary={`${items.length}건`}>
      <ul className="tl">
        {items.map((t, i) => (
          <li key={`${i}-${t.date}`}>
            <span className="when">{formatDate(t.date)}</span>
            <span>
              {t.label}
              <Cite ids={t.cite} />
            </span>
          </li>
        ))}
      </ul>
    </Fold>
  )
}
