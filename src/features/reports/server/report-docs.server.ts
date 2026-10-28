// 게시 리포트를 Firestore에서 읽는다(서버에서만). 브라우저에는 report-docs.functions.ts로 결과만 간다.
// 게시 목록은 published/{주소}가 정하고, 리포트 본문은 그 문서가 가리키는 reports/{기준일}이다.
import { PublishedSchema, ReportRecordSchema } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import { loadReportDoc } from '../doc/load'
import type { ReportDoc } from '../report-doc'
import { toSummary } from '../summary'
import type { ReportSummary } from '../summary'

/** 게시 목록을 다시 읽기까지의 시간. 리포트는 하루에 몇 번 바뀌지 않는다 */
const TTL_MS = 60_000

interface Cached<T> {
  at: number
  value: Promise<T>
}

/** TTL 동안 같은 읽기를 나눠 쓴다. 실패한 읽기는 남기지 않는다 */
export function memo<T>(read: () => Promise<T>): (now?: number) => Promise<T> {
  let cache: Cached<T> | undefined
  return (now = Date.now()) => {
    if (!cache || now - cache.at > TTL_MS) {
      const value = read()
      const entry = { at: now, value }
      cache = entry
      value.catch(() => {
        if (cache === entry) cache = undefined
      })
    }
    return cache.value
  }
}

async function readEntries() {
  const snap = await db().collection('published').get()
  return snap.docs
    .map((d) => ({ slug: d.id, ...PublishedSchema.parse(d.data()) }))
    .sort((a, b) => a.order - b.order)
}

async function readPublished(): Promise<ReadonlyArray<ReportDoc>> {
  const store = db()
  const entries = await readEntries()
  const docs = await Promise.all(
    entries.map(async ({ slug, report, subject }) => {
      const record = await store.doc(report).get()
      if (!record.exists)
        throw new Error(`게시 ${slug}의 리포트가 없다: ${report}`)
      const doc = loadReportDoc(
        ReportRecordSchema.parse(record.data()).markdown,
      )
      if (doc.slug !== slug)
        throw new Error(`게시 주소 ${slug}와 리포트 slug ${doc.slug}가 다르다`)
      return { ...doc, subject }
    }),
  )
  return docs
}

/** 게시 리포트 전체 (홈 목록 순서) */
export const publishedDocs = memo(readPublished)

/** 홈·목록용 요약. 게시 문서에 저장된 요약을 쓰고, 요약이 없는 옛 게시 문서가 있으면 리포트를 읽어 만든다 */
export const publishedSummaries = memo(
  async (): Promise<ReadonlyArray<ReportSummary>> => {
    const entries = await readEntries()
    const stored = entries.flatMap((e) => (e.summary ? [e.summary] : []))
    if (stored.length === entries.length) return stored
    return (await publishedDocs()).map(toSummary)
  },
)

export async function getReportDoc(
  slug: string,
): Promise<ReportDoc | undefined> {
  return (await publishedDocs()).find((d) => d.slug === slug)
}

/** 평가 대상 경로(programs/… · orgs/…/budgets/…)로 게시 리포트를 찾는다 */
export async function getReportBySubject(
  subject: string,
): Promise<ReportDoc | undefined> {
  return (await publishedDocs()).find((d) => d.subject === subject)
}
