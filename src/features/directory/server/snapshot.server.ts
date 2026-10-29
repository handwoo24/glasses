// 목록 스냅샷 쓰기(파이프라인)와 읽기(사이트 서버).
// 쓰기: 원본을 모아 meta/directory/chunks/{버전}-{순번}에 조각으로 쓰고, 다 쓴 뒤 meta/directory의 버전을 올린다.
// 읽기: 60초마다 meta/directory 한 건만 읽고, 버전이 바뀌었을 때만 조각을 받는다.
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { ZodType } from 'zod'
import {
  memo,
  readSummaries,
} from '#/features/reports/server/report-docs.server'
import { BudgetDocSchema, OrgSchema } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import { CardFieldsSchema, decodeSnapshot, encodeSnapshot } from '../snapshot'
import type { DirectoryData } from '../snapshot'

const POINTER = 'meta/directory'
const CHUNKS = `${POINTER}/chunks`

const PointerSchema = z.strictObject({
  version: z.number().int(),
  chunks: z.number().int().positive(),
  builtAt: z.string(),
})
type Pointer = z.infer<typeof PointerSchema>

const chunkId = (version: number, i: number) => `${version}-${i}`

function parsed<T>(schema: ZodType<T>, d: DocumentSnapshot): Array<T> {
  const r = schema.safeParse(d.data())
  if (r.success) return [r.data]
  console.warn(`[directory] 양식이 맞지 않아 건너뜀: ${d.ref.path}`)
  return []
}

/** 원본 컬렉션 전체. 스냅샷을 만들 때, 그리고 스냅샷이 아직 없을 때만 읽는다 */
export async function readSource(): Promise<DirectoryData> {
  const store = db()
  const [orgs, programs, budgets, summaries] = await Promise.all([
    store.collection('orgs').get(),
    store
      .collection('programs')
      .select('name', 'org', 'region', 'field', 'nationalProgram')
      .get(),
    store.collectionGroup('budgets').get(),
    readSummaries(),
  ])
  return {
    orgs: orgs.docs.flatMap((d) =>
      parsed(OrgSchema, d).map((org) => ({ id: d.id, org })),
    ),
    cards: programs.docs.flatMap((d) =>
      parsed(CardFieldsSchema, d).map((p) => ({ id: d.id, ...p })),
    ),
    budgetDocs: budgets.docs.flatMap((d) =>
      parsed(BudgetDocSchema, d).map((doc) => ({
        org: d.ref.parent.parent?.id ?? '',
        id: d.id,
        doc,
      })),
    ),
    summaries: [...summaries],
  }
}

/**
 * 지난 조각을 지우기까지의 유예. 루프 일꾼 여러 개가 동시에 스냅샷을 만들므로,
 * 다른 프로세스가 쓰는 중인 조각이나 서버가 받는 중인 조각을 지우지 않게 버전(쓴 시각)으로 거른다
 */
const GRACE_MS = 10 * 60_000

/**
 * 스냅샷을 새로 만들어 쓴다. 조각을 다 쓴 뒤에 버전을 올리므로 서버는 반쯤 쓴 스냅샷을 보지 않는다.
 * 지금 버전이 아니고 유예보다 오래된 조각만 지운다.
 */
export async function writeSnapshot(): Promise<Pointer & { bytes: number }> {
  const store = db()
  const data = await readSource()
  const chunks = encodeSnapshot(data)
  const pointer: Pointer = {
    version: Date.now(),
    chunks: chunks.length,
    builtAt: new Date().toISOString(),
  }
  await Promise.all(
    chunks.map((bytes, i) =>
      store.doc(`${CHUNKS}/${chunkId(pointer.version, i)}`).set({ bytes }),
    ),
  )
  // 동시에 쓴 다른 프로세스가 더 늦은 버전을 이미 올렸으면 덮지 않는다
  const live = await store.runTransaction(async (tx) => {
    const before = PointerSchema.safeParse(
      (await tx.get(store.doc(POINTER))).data(),
    )
    if (before.success && before.data.version > pointer.version)
      return before.data.version
    tx.set(store.doc(POINTER), pointer)
    return pointer.version
  })
  const stale = await store.collection(CHUNKS).listDocuments()
  const cutoff = Date.now() - GRACE_MS
  await Promise.all(
    stale
      .filter((ref) => {
        const version = Number(ref.id.split('-')[0])
        return Number.isFinite(version) && version !== live && version < cutoff
      })
      .map((ref) => ref.delete()),
  )
  return { ...pointer, bytes: chunks.reduce((n, c) => n + c.byteLength, 0) }
}

async function readChunks(pointer: Pointer): Promise<DirectoryData> {
  const refs = Array.from({ length: pointer.chunks }, (_, i) =>
    db().doc(`${CHUNKS}/${chunkId(pointer.version, i)}`),
  )
  const snaps = await db().getAll(...refs)
  const bytes = snaps.map((s) => {
    const value: unknown = s.get('bytes')
    if (!(value instanceof Uint8Array))
      throw new Error(`스냅샷 조각이 없다: ${s.ref.path}`)
    return value
  })
  return decodeSnapshot(bytes)
}

let loaded: { version: number; data: DirectoryData } | undefined

async function current(): Promise<DirectoryData> {
  const snap = await db().doc(POINTER).get()
  // 스냅샷을 아직 만들지 않은 환경(새 에뮬레이터 등)에서는 원본을 직접 읽는다
  if (!snap.exists) return readSource()
  const pointer = PointerSchema.safeParse(snap.data())
  if (!pointer.success) {
    console.warn(`[directory] ${POINTER} 양식이 맞지 않아 원본을 읽음`)
    return readSource()
  }
  if (loaded?.version === pointer.data.version) return loaded.data
  try {
    const data = await readChunks(pointer.data)
    loaded = { version: pointer.data.version, data }
    return data
  } catch (e) {
    console.error(`[directory] 스냅샷 ${pointer.data.version}을 읽지 못함`, e)
    return loaded?.data ?? readSource()
  }
}

/** 목록 화면이 읽는 데이터. 60초마다 버전만 확인한다 */
export const directoryData = memo(current)
