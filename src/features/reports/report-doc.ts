/**
 * 리포트 화면 한 장이 받는 데이터. 마크다운 문서(doc/)에서 읽거나,
 * 아직 문서로 옮기지 않은 리포트는 TS 데이터(Report + Assessment)를 이 모양으로 맞춘다.
 */
import type { AxisId } from './axes'
import { allSources, classifyChecks, signalsByAxis } from './assessment'
import type { Assessment, ClassifiedCheck } from './assessment'
import type {
  BudgetBasis,
  Contract,
  DisclosureItem,
  Oversight,
  Report,
  RiskSignal,
  Source,
  TimelineItem,
} from './schema'

export interface ReportDoc extends Omit<
  Assessment,
  'reportSlug' | 'checkMap' | 'newChecks' | 'signalAxis' | 'extraSources'
> {
  slug: string
  /** 축과 답이 정해진 점검 */
  checks: ReadonlyArray<ClassifiedCheck>
  /** 축별 위험 지표 */
  signals: Record<AxisId, ReadonlyArray<RiskSignal>>
  /** 화면 각주 번호는 이 순서다 */
  sources: ReadonlyArray<Source>
  budgetBasis?: BudgetBasis
  contracts?: { intro: string; items: ReadonlyArray<Contract> }
  oversight: ReadonlyArray<Oversight>
  disclosure: ReadonlyArray<DisclosureItem>
  timeline: ReadonlyArray<TimelineItem>
}

/** TS 리포트 데이터와 평가를 화면 데이터로 합친다 */
export function fromReportAndAssessment(
  report: Report,
  assessment: Assessment,
): ReportDoc {
  const {
    reportSlug,
    checkMap: _checkMap,
    newChecks: _newChecks,
    signalAxis: _signalAxis,
    extraSources: _extraSources,
    ...rest
  } = assessment
  return {
    ...rest,
    slug: reportSlug,
    checks: classifyChecks(report, assessment),
    signals: signalsByAxis(report, assessment),
    sources: allSources(report, assessment),
    budgetBasis: report.budgetBasis,
    contracts: report.contracts,
    oversight: report.oversight,
    disclosure: report.disclosure,
    timeline: report.timeline,
  }
}
