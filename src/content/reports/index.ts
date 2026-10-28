import { ReportSchema } from '#/features/reports/schema'
import type { Report } from '#/features/reports/schema'
import { autonomousBusDallilGoyang } from './autonomous-bus-dallil-goyang'
import { budget2026ThirdSupplementary } from './budget-2026-3rd-supplementary'
import { evSubsidy2026Round3 } from './ev-subsidy-2026-round3'

// 양식에 맞지 않는 리포트는 로드 시점에 실패시켜 게시되지 않게 한다.
export const reports: ReadonlyArray<Report> = [
  budget2026ThirdSupplementary,
  autonomousBusDallilGoyang,
  evSubsidy2026Round3,
].map((r) => ReportSchema.parse(r))

export function getReport(slug: string): Report | undefined {
  return reports.find((r) => r.slug === slug)
}
