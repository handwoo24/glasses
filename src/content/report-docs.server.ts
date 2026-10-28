import type { ReportDoc } from '#/features/reports/report-doc'
import { loadReportDoc } from '#/features/reports/doc/load'
import autonomousBusDallilGoyang from './reports/autonomous-bus-dallil-goyang.md?raw'
import budget2026ThirdSupplementary from './reports/budget-2026-3rd-supplementary.md?raw'
import evSubsidy2026Round3 from './reports/ev-subsidy-2026-round3.md?raw'

// 서버에서만 읽는다. 브라우저에는 report-docs.functions.ts의 서버 함수로 결과(JSON)만 간다.

/** 게시 리포트. 문서(reports/*.md)는 로드할 때 양식을 검사해 틀리면 실패한다 */
export const reportDocs: ReadonlyArray<ReportDoc> = [
  autonomousBusDallilGoyang,
  budget2026ThirdSupplementary,
  evSubsidy2026Round3,
].map(loadReportDoc)

export function getReportDoc(slug: string): ReportDoc | undefined {
  return reportDocs.find((d) => d.slug === slug)
}
