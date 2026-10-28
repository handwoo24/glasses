import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { ReportChart } from '../charts/report-chart'
import { formatDate } from '../format'
import type { Chart, Report } from '../schema'
import {
  DisclosureLedger,
  OversightTable,
  RiskSignalBoard,
} from './audit-ledgers'
import { CityResponsePanel, NextReview, ScopeBox } from './audit-frame'
import { Checklist } from './checklist'
import { BriefCard, NextSteps, OutcomeBlock, VendorTable } from './citizen'
import { Cite, CiteProvider } from './cite'
import { ContractTable } from './contract-table'
import { GlossaryList } from './glossary-list'
import { MoneyPathView } from './money-path'
import { SourceList } from './source-list'
import { Timeline } from './timeline'
import { GradeBreakdown, Verdict } from './verdict'
import { Waterfall } from './waterfall'

const ENTITY_LABEL = {
  city: '고양특례시',
  council: '고양특례시의회',
  both: '고양특례시 · 시의회',
} as const

interface SectionProps {
  id: string
  title: string
  lead?: string
  children: ReactNode
}

function Section({ id, title, lead, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="mt-16">
      <h2
        id={id}
        className="m-0 font-serif text-[1.4rem] font-bold tracking-tight"
      >
        {title}
      </h2>
      {lead && (
        <p className="m-0 mt-2 text-[14px] leading-relaxed text-muted">
          {lead}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  )
}

interface ChartsProps {
  charts: ReadonlyArray<Chart>
  section: Chart['section']
}

function Charts({ charts, section }: ChartsProps) {
  const list = charts.filter((c) => c.section === section)
  if (list.length === 0) return null
  return (
    <div className="mt-10 space-y-10">
      {list.map((c) => (
        <ReportChart key={c.id} chart={c} />
      ))}
    </div>
  )
}

interface ReportViewProps {
  report: Report
  today: string
}

export function ReportView({ report: r, today }: ReportViewProps) {
  useOpenDetailsOnHash()
  const attached = new Set(r.points.flatMap((p) => p.charts))
  const looseCharts = r.charts.filter((c) => !attached.has(c.id))
  return (
    <CiteProvider sourceIds={r.sources.map((s) => s.id)}>
      <article className="rise mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-8">
        <header className="grid gap-6 lg:grid-cols-[12rem_1fr] lg:gap-12">
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 self-start border-t-[3px] border-accent pt-3 text-[13px] lg:grid-cols-1">
            <Meta label="기관">{ENTITY_LABEL[r.entity]}</Meta>
            <Meta label="분야">{r.category}</Meta>
            <Meta label="담당">{r.departments.join(', ')}</Meta>
            <Meta label="상태">{r.status}</Meta>
            <Meta label="작성">{formatDate(r.publishedAt)}</Meta>
            <Meta label="갱신">{formatDate(r.updatedAt)}</Meta>
          </dl>
          <div>
            <h1 className="m-0 font-serif text-[1.85rem] font-black leading-[1.3] tracking-tight sm:text-[2.4rem]">
              {r.title}
            </h1>
            <div className="mt-6">
              <BriefCard brief={r.brief} />
            </div>
          </div>
        </header>

        <div className="mt-12 lg:ml-60">
          <Verdict
            verdict={r.verdict}
            points={r.points}
            charts={r.charts}
            checks={r.checks}
            total={r.scope.total}
            responseNote={RESPONSE_NOTE[r.response.status]}
          />

          {(r.moneyPath || r.vendors.length > 0) && (
            <Section
              id="money"
              title="돈은 어디로 갔고, 누가 맡았나"
              lead="이름이 나온 회사·기관은 공개 자료에 있는 그대로입니다. 업체 대표자 등 개인 정보는 싣지 않습니다."
            >
              {r.moneyPath && <MoneyPathView path={r.moneyPath} />}
              {r.vendors.length > 0 && (
                <div className={r.moneyPath ? 'mt-10' : ''}>
                  <VendorTable vendors={r.vendors} />
                </div>
              )}
            </Section>
          )}

          <Section id="outcome" title="그래서 잘 됐나">
            <OutcomeBlock outcome={r.outcome} />
          </Section>

          <Section id="next" title="다음에 무엇을">
            <NextSteps
              unknowns={r.unknowns}
              questions={r.openQuestions}
              recommendations={r.recommendations}
              actions={r.actions}
              nextReview={r.nextReview}
            />
          </Section>

          <Section
            id="details"
            title="자세히 보기"
            lead="감시 점검표, 판단 기준, 계약 상세처럼 판정을 검증하려는 분을 위한 자료입니다. 제목을 누르면 펼쳐집니다."
          >
            <GradeBreakdown
              checks={r.checks}
              skipped={r.skippedAreas}
              total={r.scope.total}
            />
            <div className="mt-8 border-t border-ink">
              <Fold
                id="fold-checks"
                title="감시 점검표"
                hint={`${r.checks.length}개 질문 · 판단 기준과 걸린 돈`}
              >
                <p className="m-0 mb-6 text-[13.5px] text-muted">
                  ○ 확인됨 · △ 주의 · ✕ 문제 · ? 확인 불가
                </p>
                <Checklist
                  checks={r.checks}
                  skipped={r.skippedAreas}
                  total={r.scope.total}
                />
              </Fold>
              <Fold id="fold-scope" title="점검 범위와 자료 기준일">
                <ScopeBox scope={r.scope} />
                <NextReview nextReview={r.nextReview} />
              </Fold>
              {r.riskSignals.length > 0 && (
                <Fold
                  id="fold-risk"
                  title="예산 누수 위험 신호"
                  hint="위법은 아니지만 확인이 필요한 지표"
                >
                  <RiskSignalBoard items={r.riskSignals} />
                </Fold>
              )}
              {r.contracts && (
                <Fold
                  id="fold-contracts"
                  title="계약 상세"
                  hint={`${r.contracts.items.length}건 · 입찰·지급 내역`}
                >
                  <ContractTable
                    intro={r.contracts.intro}
                    items={r.contracts.items}
                  />
                  <Charts charts={looseCharts} section="contract" />
                </Fold>
              )}
              {r.oversight.length > 0 && (
                <Fold
                  id="fold-oversight"
                  title="누가 감시했나"
                  hint="시 감사부서 · 시의회 · 경기도 · 감사원 · 중앙부처"
                >
                  <OversightTable items={r.oversight} />
                </Fold>
              )}
              {r.disclosure.length > 0 && (
                <Fold
                  id="fold-disclosure"
                  title="공개돼야 할 문서"
                  hint="게시 의무 · 청구 여부"
                >
                  <p className="m-0 mb-5 text-[14px] leading-relaxed text-ink-soft">
                    법령상 게시 의무가 있는데 게시하지 않았거나 청구가 거부되면
                    ‘문제’, 아직 청구하지 않은 문서는 ‘확인 필요’로 봅니다.
                  </p>
                  <DisclosureLedger items={r.disclosure} />
                </Fold>
              )}
              {(r.budgetBasis || r.moneyFlow) && (
                <Fold id="fold-budget" title="예산이 정해진 과정">
                  <BudgetBasis report={r} />
                </Fold>
              )}
              {looseCharts.some((c) => c.section !== 'contract') && (
                <Fold id="fold-charts" title="그 밖의 자료">
                  <Charts charts={looseCharts} section="budget" />
                  <Charts charts={looseCharts} section="execution" />
                </Fold>
              )}
              <Fold id="fold-response" title="시의 해명 전체">
                <CityResponsePanel response={r.response} />
              </Fold>
              <Fold id="fold-timeline" title="진행 경과">
                <Timeline items={r.timeline} today={today} />
              </Fold>
            </div>
          </Section>

          {r.glossary.length > 0 && (
            <Section id="glossary" title="용어 풀이">
              <GlossaryList terms={r.glossary} />
            </Section>
          )}

          <Section id="sources" title="출처">
            <SourceList sources={r.sources} />
          </Section>

          <aside className="mt-14 border border-rule bg-sheet px-5 py-4 text-[13px] leading-relaxed text-ink-soft">
            <p className="m-0 font-semibold text-ink">
              이 리포트는 이렇게 만들었습니다
            </p>
            <p className="m-0 mt-1">
              {r.authorship.method}. 평가 기준 v{r.authorship.rubricVersion}.
              원문은 고치지 않고 링크로 제공합니다. 틀린 내용이 있으면 알려
              주세요.
            </p>
          </aside>
        </div>
      </article>
    </CiteProvider>
  )
}

const RESPONSE_NOTE: Record<Report['response']['status'], string> = {
  'not-asked':
    '이 판정은 시에 따로 묻기 전의 것입니다. 아래 ‘시의 해명’은 시가 의회 회의 등 공식 석상에서 한 설명을 옮긴 것입니다.',
  asked:
    '시에 질의했고 답을 기다리는 중입니다. 아래 ‘시의 해명’은 시가 공식 석상에서 한 설명입니다.',
  answered: '시의 답변을 받아 반영했습니다.',
  'no-answer':
    '시에 질의했지만 기한 안에 답이 없었습니다. 아래 ‘시의 해명’은 시가 공식 석상에서 한 설명입니다.',
}

interface FoldProps {
  id: string
  title: string
  hint?: string
  children: ReactNode
}

/** 감사용 상세를 접어 둔다. 주소의 #id가 안에 있으면 useOpenDetailsOnHash가 펼친다 */
function Fold({ id, title, hint, children }: FoldProps) {
  return (
    <details id={id} className="group border-b border-rule">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 py-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block w-4 text-accent transition-transform duration-200 group-open:rotate-90"
        >
          ›
        </span>
        <span className="font-serif text-[1.05rem] font-bold">{title}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </summary>
      <div className="pb-8 pt-2">{children}</div>
    </details>
  )
}

/** 접힌 상세 안의 앵커(#check-budget 등)로 이동하면 그 상세를 펼친다 */
function useOpenDetailsOnHash() {
  useEffect(() => {
    const open = () => {
      const raw = window.location.hash.slice(1)
      if (!raw) return
      const target =
        document.getElementById(raw) ?? document.getElementById(safeDecode(raw))
      let el = target?.parentElement?.closest('details') ?? null
      if (target instanceof HTMLDetailsElement) target.open = true
      while (el) {
        el.open = true
        el = el.parentElement?.closest('details') ?? null
      }
      target?.scrollIntoView()
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function BudgetBasis({ report: r }: { report: Report }) {
  return (
    <>
      {r.budgetBasis && (
        <>
          <p className="m-0 text-[15.5px] leading-[1.85]">
            {r.budgetBasis.intro}
          </p>
          <ol className="m-0 mt-6 list-none space-y-5 p-0">
            {r.budgetBasis.steps.map((s, i) => (
              <li key={`${i}-${s.label}`} className="grid grid-cols-[2rem_1fr]">
                <span className="font-serif text-[1.05rem] font-bold text-accent">
                  {i + 1}
                </span>
                <div>
                  <p className="m-0 font-semibold">{s.label}</p>
                  <p className="m-0 mt-1 text-[15px] leading-[1.8] text-ink-soft">
                    {s.detail}
                    <Cite ids={s.cite} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {r.moneyFlow && (
        <div className="mt-10">
          <Waterfall flow={r.moneyFlow} />
        </div>
      )}
    </>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  )
}
