// 게시 리포트를 Firestore에서 읽는다(서버에서만). 브라우저에는 report-docs.functions.ts로 결과만 간다.
// 게시 목록은 published/{주소}가 정하고, 리포트 본문은 그 문서가 가리키는 reports/{기준일}이다.
import { PublishedSchema, ReportRecordSchema } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import { loadReportDoc } from '../doc/load'
import type { ReportDoc } from '../report-doc'

/** 게시 목록을 다시 읽기까지의 시간. 리포트는 하루에 몇 번 바뀌지 않는다 */
const TTL_MS = 60_000

let cache: { at: number; docs: Promise<ReadonlyArray<ReportDoc>> } | undefined

async function readPublished(): Promise<ReadonlyArray<ReportDoc>> {
  const store = db()
  const snap = await store.collection('published').get()
  const entries = snap.docs
    .map((d) => ({ slug: d.id, ...PublishedSchema.parse(d.data()) }))
    .sort((a, b) => a.order - b.order)
  const docs = await Promise.all(
    entries.map(async ({ slug, report }) => {
      const record = await store.doc(report).get()
      if (!record.exists)
        throw new Error(`게시 ${slug}의 리포트가 없다: ${report}`)
      const doc = loadReportDoc(
        ReportRecordSchema.parse(record.data()).markdown,
      )
      if (doc.slug !== slug)
        throw new Error(`게시 주소 ${slug}와 리포트 slug ${doc.slug}가 다르다`)
      return doc
    }),
  )
  return docs
}

/** 게시 리포트 전체 (홈 목록 순서) */
export function publishedDocs(
  now = Date.now(),
): Promise<ReadonlyArray<ReportDoc>> {
  if (!cache || now - cache.at > TTL_MS) {
    const docs = readPublished()
    cache = { at: now, docs }
    // 실패한 읽기를 캐시에 남기지 않는다
    docs.catch(() => {
      if (cache?.docs === docs) cache = undefined
    })
  }
  return cache.docs
}

export async function getReportDoc(
  slug: string,
): Promise<ReportDoc | undefined> {
  return (await publishedDocs()).find((d) => d.slug === slug)
}
