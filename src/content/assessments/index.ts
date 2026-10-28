import type { Assessment } from '#/features/reports/assessment'
import { autonomousBusDallilGoyangAssessment } from './autonomous-bus-dallil-goyang'
import { budget2026ThirdSupplementaryAssessment } from './budget-2026-3rd-supplementary'
import { evSubsidy2026Assessment } from './ev-subsidy-2026-round3'

/** 리포트 slug → 7개 축 평가 (평가 체계 v0.1) */
export const assessments: ReadonlyArray<Assessment> = [
  autonomousBusDallilGoyangAssessment,
  budget2026ThirdSupplementaryAssessment,
  evSubsidy2026Assessment,
]

export function getAssessment(reportSlug: string): Assessment | undefined {
  return assessments.find((a) => a.reportSlug === reportSlug)
}
