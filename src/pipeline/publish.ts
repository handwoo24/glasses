// 검증을 통과한 리포트를 게시한다. 루프가 사람 확인 없이 부르므로 게시해도 되는지는 도구가 정한다.
import { loadReportDoc } from '#/features/reports/doc/load'
import { stageOf } from '#/features/worklist/stage'
import type { SubjectProgress } from '#/features/worklist/stage'
import { checkFacts } from './check'
import { resolve } from './paths'
import { PublishedSchema, ReportRecordSchema, ReviewSchema } from './schemas'
import { get, list, put } from './store'

type Reports = SubjectProgress['reports']
type Reviews = SubjectProgress['reviews']

/**
 * 게시하지 못하는 이유. 게시해도 되면 undefined.
 * 작업 현황의 ‘게시 대기’와 같은 조건이다: 가장 늦은 판이고, 검토 요청 중이고, 그 판을 고친 뒤의 마지막 검증이 pass.
 */
export function publishBlocker(
  asOf: string,
  reports: Reports,
  reviews: Reviews,
): string | undefined {
  const latest = [...reports].sort((a, b) => b.asOf.localeCompare(a.asOf))[0]
  if (!(latest as Reports[number] | undefined) || latest.asOf !== asOf)
    return `가장 늦은 판이 아니다 (가장 늦은 판: ${latest.asOf})`
  if (latest.status !== 'in-review')
    return `검토 요청(in-review) 상태가 아니다: ${latest.status}`
  const stage = stageOf({
    materials: 0,
    facts: 0,
    absences: 0,
    reports,
    reviews,
    published: false,
  })
  if (stage !== '게시 대기')
    return `이 판을 고친 뒤의 마지막 검증이 pass가 아니다 (단계: ${stage})`
  return undefined
}

async function progressOf(
  subject: string,
): Promise<{ reports: Reports; reviews: Reviews }> {
  const [reports, reviews] = await Promise.all([
    list(`${subject}/reports`),
    list(`${subject}/reviews`),
  ])
  return {
    reports: reports.map(({ id, data }) => {
      const r = ReportRecordSchema.parse(data)
      return { asOf: id, status: r.status, updatedAt: r.updatedAt }
    }),
    reviews: reviews.map(({ data }) => {
      const r = ReviewSchema.parse(data)
      return {
        report: r.report,
        verdict: r.verdict,
        reviewedAt: r.reviewedAt,
      }
    }),
  }
}

/** 같은 주소에 게시한 적이 있으면 그 순서를, 없으면 맨 뒤 순서를 쓴다 */
async function orderFor(slug: string, subject: string): Promise<number> {
  const all = await list('published')
  const docs = all.map(({ id, data }) => ({
    id,
    ...PublishedSchema.parse(data),
  }))
  const same = docs.find((d) => d.id === slug)
  if (same && same.subject !== subject)
    throw new Error(
      `게시 주소 ${slug}는 다른 평가 대상(${same.subject})이 쓰고 있다`,
    )
  if (same) return same.order
  return docs.reduce((max, d) => Math.max(max, d.order), 0) + 1
}

/** 리포트 한 판을 게시한다. 게시 주소와 순서를 돌려준다 */
export async function publish(
  report: string,
  now = new Date(),
): Promise<{ slug: string; order: number }> {
  const { kind, parent } = resolve(report)
  if (kind !== 'report' || !parent)
    throw new Error(`리포트 경로가 아니다: ${report}`)
  const asOf = report.split('/').at(-1) ?? ''
  const { reports, reviews } = await progressOf(parent)
  const blocker = publishBlocker(asOf, reports, reviews)
  if (blocker) throw new Error(`게시하지 않는다: ${blocker}`)

  const problems = await checkFacts(parent)
  if (problems.length)
    throw new Error(`게시하지 않는다: check-facts 문제 ${problems.length}건`)

  const record = ReportRecordSchema.parse(await get(report))
  const { slug } = loadReportDoc(record.markdown)
  const order = await orderFor(slug, parent)
  const at = now.toISOString()
  await put(report, { ...record, status: 'published', updatedAt: at })
  await put(`published/${slug}`, {
    report,
    subject: parent,
    order,
    publishedAt: at,
  })
  return { slug, order }
}
