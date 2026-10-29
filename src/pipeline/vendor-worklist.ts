// 업체 루프의 조사 목록. 따로 적어 두지 않고, 게시된 사업과 업체 카드·산출물로 계산한다(사업 작업 현황과 같은 방식).
import { stageOf } from '#/features/worklist/stage'
import type { WorkStage } from '#/features/worklist/stage'
import {
  ProgramSchema,
  PublishedSchema,
  PublishedVendorSchema,
  ReportRecordSchema,
  ReviewSchema,
  VendorCardSchema,
} from './schemas'
import { db } from './store'

export interface VendorWork {
  /** programs/{사업}/vendors/{사업자등록번호} */
  path: string
  name: string
  role: string
  /** 이 사업 안 계약 금액 합계(원) */
  amount: number
  priority: 'high' | 'medium' | 'low'
  stage: WorkStage
}

/** 게시된 사업 가운데 업체 목록화가 남은 것 (게시 순서대로). 재정 문서는 업체를 목록화하지 않는다 */
export function programsToList(
  published: ReadonlyArray<{ subject: string; order: number }>,
  listed: ReadonlySet<string>,
): Array<string> {
  return [...published]
    .filter((p) => p.subject.startsWith('programs/') && !listed.has(p.subject))
    .sort((a, b) => a.order - b.order)
    .map((p) => p.subject)
}

/** 루프가 고르는 순서: 고침 → 검증 → 작성·분석·수집(이어 하기) → 게시 대기 → 대기 → 게시. 같은 단계면 우선순위·금액 순 */
const STAGE_ORDER: Record<WorkStage, number> = {
  고침: 0,
  검증: 1,
  작성: 2,
  분석: 3,
  수집: 4,
  '게시 대기': 5,
  대기: 6,
  게시: 7,
}
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export function sortVendorWork(
  items: ReadonlyArray<VendorWork>,
): Array<VendorWork> {
  return [...items].sort(
    (a, b) =>
      STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.amount - a.amount,
  )
}

async function stageOfVendor(path: string): Promise<WorkStage> {
  const store = db()
  const [materials, facts, absences, reports, reviews, published] =
    await Promise.all([
      store
        .collection('materials')
        .where('subjects', 'array-contains', path)
        .select()
        .get(),
      store.collection(`${path}/facts`).select().get(),
      store.collection(`${path}/absences`).select().get(),
      store.collection(`${path}/reports`).get(),
      store.collection(`${path}/reviews`).get(),
      store
        .collection('publishedVendors')
        .where('subject', '==', path)
        .select()
        .get(),
    ])
  return stageOf({
    materials: materials.size,
    facts: facts.size,
    absences: absences.size,
    reports: reports.docs.map((d) => {
      const r = ReportRecordSchema.parse(d.data())
      return { asOf: d.id, status: r.status, updatedAt: r.updatedAt }
    }),
    reviews: reviews.docs.map((d) => {
      const r = ReviewSchema.parse(d.data())
      return { report: r.report, verdict: r.verdict, reviewedAt: r.reviewedAt }
    }),
    published: !published.empty,
  })
}

/** 업체 루프의 조사 목록: 목록화가 남은 사업과 업체 카드별 작업 단계. 기관코드를 주면 그 기관 사업만 */
export async function readVendorWorklist(org?: string): Promise<{
  toList: Array<string>
  vendors: Array<VendorWork>
}> {
  const store = db()
  const inOrg = (subject: string) =>
    !org || subject.startsWith(`programs/${org}.`)
  const [published, programs, cards] = await Promise.all([
    store.collection('published').get(),
    store.collection('programs').get(),
    // 같은 이름의 최상위 레지스트리(vendors/{번호})는 빼고 사업 아래 카드만
    store.collectionGroup('vendors').get(),
  ])
  const listed = new Set(
    programs.docs
      .filter((d) => ProgramSchema.parse(d.data()).vendorsListedAt)
      .map((d) => `programs/${d.id}`),
  )
  const toList = programsToList(
    published.docs.map((d) => PublishedSchema.parse(d.data())),
    listed,
  ).filter(inOrg)
  const vendorCards = cards.docs.filter(
    (d) => d.ref.parent.parent !== null && inOrg(d.ref.path),
  )
  const vendors = await Promise.all(
    vendorCards.map(async (d) => {
      const card = VendorCardSchema.parse(d.data())
      return {
        path: d.ref.path,
        name: card.name,
        role: card.role,
        amount: card.contracts.reduce((s, c) => s + c.amount, 0),
        priority: card.priority.score,
        stage: await stageOfVendor(d.ref.path),
      }
    }),
  )
  return { toList, vendors: sortVendorWork(vendors) }
}

/** 게시된 업체 리포트 (사업 리포트의 참여 업체 표에서 잇는다) */
export async function readPublishedVendors() {
  const snap = await db().collection('publishedVendors').get()
  return snap.docs.map((d) => ({
    slug: d.id,
    ...PublishedVendorSchema.parse(d.data()),
  }))
}
