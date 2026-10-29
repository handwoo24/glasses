// 목록 화면(기관 고르기 · 기관 페이지 · 사업 목록)이 읽는 것의 사본.
// 파이프라인이 쓸 때 한 번 만들어 Firestore에 조각으로 두고, 서버는 버전이 바뀔 때만 받아 메모리에서 거른다.
import { gunzipSync, gzipSync } from 'node:zlib'
import { z } from 'zod'
import { ReportSummarySchema } from '#/features/reports/summary'
import { BudgetDocSchema, OrgSchema, ProgramSchema } from '#/pipeline/schemas'

/** 사업 카드에서 목록에 쓰는 필드만 */
export const CardFieldsSchema = ProgramSchema.pick({
  name: true,
  org: true,
  region: true,
  field: true,
  nationalProgram: true,
})

export const DirectoryDataSchema = z.strictObject({
  orgs: z.array(z.strictObject({ id: z.string(), org: OrgSchema })),
  cards: z.array(CardFieldsSchema.extend({ id: z.string() })),
  budgetDocs: z.array(
    z.strictObject({ org: z.string(), id: z.string(), doc: BudgetDocSchema }),
  ),
  summaries: z.array(ReportSummarySchema),
})
export type DirectoryData = z.infer<typeof DirectoryDataSchema>

/** 조각 하나의 크기. Firestore 문서 한도(1MiB)에 필드 이름·색인 여유를 둔다 */
export const CHUNK_BYTES = 900_000

export function encodeSnapshot(data: DirectoryData): Array<Buffer> {
  const packed = gzipSync(JSON.stringify(data))
  return Array.from(
    { length: Math.max(1, Math.ceil(packed.byteLength / CHUNK_BYTES)) },
    (_, i) => packed.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES),
  )
}

export function decodeSnapshot(
  chunks: ReadonlyArray<Uint8Array>,
): DirectoryData {
  const json = gunzipSync(Buffer.concat(chunks)).toString('utf8')
  return DirectoryDataSchema.parse(JSON.parse(json))
}
