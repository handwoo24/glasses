// 게시된 업체 리포트를 Firestore에서 읽는다(서버에서만). 게시 목록은 publishedVendors/{주소}가 정한다.
import { memo } from '#/features/reports/server/report-docs.server'
import { PublishedVendorSchema, ReportRecordSchema } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import { loadVendorDoc } from '../doc/load'
import type { VendorReportDoc } from '../vendor-doc'

/** 게시 문서 하나를 읽는다. 깨진 문서는 로그를 남기고 빼서, 다른 업체 페이지는 열리게 한다 */
async function readEntry(
  id: string,
  data: unknown,
): Promise<VendorReportDoc | undefined> {
  try {
    const { report, subject } = PublishedVendorSchema.parse(data)
    const record = await db().doc(report).get()
    if (!record.exists) throw new Error(`리포트가 없다: ${report}`)
    const doc = loadVendorDoc(ReportRecordSchema.parse(record.data()).markdown)
    if (doc.slug !== id)
      throw new Error(`게시 주소와 리포트 slug ${doc.slug}가 다르다`)
    return { ...doc, subject }
  } catch (e) {
    console.error(`업체 게시 ${id}를 읽지 못했다:`, e)
    return undefined
  }
}

const readAll = memo(async (): Promise<ReadonlyArray<VendorReportDoc>> => {
  const snap = await db().collection('publishedVendors').get()
  const docs = await Promise.all(
    snap.docs.map((d) => readEntry(d.id, d.data())),
  )
  return docs.filter((d): d is VendorReportDoc => d !== undefined)
})

/** 업체 평가 대상 경로로 게시된 업체 리포트 한 건 */
export async function getVendorReport(
  subject: string,
): Promise<VendorReportDoc | undefined> {
  return (await readAll()).find((d) => d.subject === subject)
}

/** 사업 하나의 게시된 업체 리포트들 (사업 리포트의 참여 업체 표에서 잇는다) */
export async function vendorReportsOf(
  program: string,
): Promise<ReadonlyArray<VendorReportDoc>> {
  return (await readAll()).filter((d) => d.program === program)
}
