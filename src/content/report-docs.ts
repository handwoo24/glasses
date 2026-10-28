import { fromReportAndAssessment } from '#/features/reports/report-doc'
import type { ReportDoc } from '#/features/reports/report-doc'
import { loadReportDoc } from '#/features/reports/doc/load'
import { budget2026ThirdSupplementaryAssessment } from './assessments/budget-2026-3rd-supplementary'
import { evSubsidy2026Assessment } from './assessments/ev-subsidy-2026-round3'
import autonomousBusDallilGoyang from './reports/autonomous-bus-dallil-goyang.md?raw'
import { getReport } from './reports'

function fromTs(
  assessment: Parameters<typeof fromReportAndAssessment>[1],
): ReportDoc {
  const report = getReport(assessment.reportSlug)
  if (!report) throw new Error(`리포트 없음: ${assessment.reportSlug}`)
  return fromReportAndAssessment(report, assessment)
}

/**
 * 게시 리포트. 마크다운 문서(reports/*.md)는 로드할 때 양식을 검사해 틀리면 실패한다.
 * 아직 문서로 옮기지 않은 리포트는 TS 데이터(reports/*.ts + assessments/*.tsx)에서 만든다.
 */
export const reportDocs: ReadonlyArray<ReportDoc> = [
  loadReportDoc(autonomousBusDallilGoyang),
  fromTs(budget2026ThirdSupplementaryAssessment),
  fromTs(evSubsidy2026Assessment),
]

export function getReportDoc(slug: string): ReportDoc | undefined {
  return reportDocs.find((d) => d.slug === slug)
}
