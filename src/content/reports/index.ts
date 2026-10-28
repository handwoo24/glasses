import { ReportSchema } from '#/features/reports/schema'
import type { Report } from '#/features/reports/schema'
import { budget2026ThirdSupplementary } from './budget-2026-3rd-supplementary'
import { evSubsidy2026Round3 } from './ev-subsidy-2026-round3'

// 아직 문서(.md)로 옮기지 않은 리포트의 TS 데이터. 양식에 맞지 않으면 로드 시점에 실패한다.
export const reports: ReadonlyArray<Report> = [
  budget2026ThirdSupplementary,
  evSubsidy2026Round3,
].map((r) => ReportSchema.parse(r))

export function getReport(slug: string): Report | undefined {
  return reports.find((r) => r.slug === slug)
}
