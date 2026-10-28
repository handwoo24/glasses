// 사업 하나가 리포트 작업의 어디까지 왔나. 따로 적어 두지 않고 Firestore에 남은 산출물로 정한다.
import type { ReportRecord, Review } from '#/pipeline/schemas'

export const WORK_STAGES = [
  '대기',
  '수집',
  '분석',
  '작성',
  '검증',
  '고침',
  '게시 대기',
  '게시',
] as const
export type WorkStage = (typeof WORK_STAGES)[number]

/** 단계마다 다음에 할 일 (상황판에 보인다) */
export const NEXT_STEP: Record<WorkStage, string> = {
  대기: '새 세션에서 리포트 작성 시작',
  수집: '자료를 사실 원장으로 옮기기',
  분석: '리포트 초안 쓰기',
  작성: '초안을 마치고 검증 세션 열기',
  검증: '검증 세션에서 대조',
  고침: '검증 지적을 고쳐 다시 검증',
  '게시 대기': '사람이 읽고 게시',
  게시: '다음 판단 시점에 갱신',
}

export interface SubjectProgress {
  materials: number
  facts: number
  absences: number
  /** reports/{기준일} 문서들 */
  reports: ReadonlyArray<
    Pick<ReportRecord, 'status' | 'updatedAt'> & { asOf: string }
  >
  reviews: ReadonlyArray<Pick<Review, 'report' | 'verdict' | 'reviewedAt'>>
  published: boolean
}

/**
 * 가장 늦은 판의 리포트와 그 판에 대한 마지막 검증으로 단계를 정한다.
 * 검증 뒤에 리포트를 고쳤으면 그 검증은 지난 것이다. 게시한 사업에 새 판을 쓰는 중이면 그 판의 단계를 보인다.
 */
export function stageOf(p: SubjectProgress): WorkStage {
  const latest = [...p.reports].sort((a, b) =>
    b.asOf.localeCompare(a.asOf),
  )[0] as SubjectProgress['reports'][number] | undefined
  if (p.published && (!latest || latest.status === 'published')) return '게시'
  if (latest) {
    const edited = Date.parse(latest.updatedAt)
    const review = p.reviews
      .filter(
        (r) => r.report === latest.asOf && Date.parse(r.reviewedAt) >= edited,
      )
      .sort(
        (a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt),
      )[0] as SubjectProgress['reviews'][number] | undefined
    if (review) return review.verdict === 'pass' ? '게시 대기' : '고침'
    if (latest.status === 'published') return '게시 대기'
    return latest.status === 'in-review' ? '검증' : '작성'
  }
  if (p.facts > 0 || p.absences > 0) return '분석'
  if (p.materials > 0) return '수집'
  return '대기'
}
