// 파이프라인 산출물 읽기·쓰기. 쓰기 전에 양식과 참조(사업·자료·리포트가 있는지)를 검사한다.
import { existsSync, readFileSync } from 'node:fs'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import type { Firestore } from 'firebase-admin/firestore'
import { loadReportDoc } from '#/features/reports/doc/load'
import { isCollection, resolve } from './paths'
import type { Kind } from './paths'

const DEFAULT_PROJECT = 'demo-glasses'

function app() {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: process.env.GLASSES_FIRESTORE_PROJECT ?? DEFAULT_PROJECT,
    })
  )
}
let cached: Firestore | undefined

/**
 * 에뮬레이터(FIRESTORE_EMULATOR_HOST)가 아니면 GLASSES_FIRESTORE_PROJECT를 명시해야 연결한다.
 * 실수로 운영 데이터에 쓰지 않게 하려는 것이다.
 */
export function db(): Firestore {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  const project = process.env.GLASSES_FIRESTORE_PROJECT
  if (!emulator && !project)
    throw new Error(
      'FIRESTORE_EMULATOR_HOST(에뮬레이터) 또는 GLASSES_FIRESTORE_PROJECT(운영)를 정해야 한다',
    )
  if (cached) return cached
  const store = getFirestore(app())
  // 선택 필드(undefined)는 쓰지 않는다. 문서를 통째로 쓸 때 빠진 필드는 지워진다
  store.settings({ ignoreUndefinedProperties: true })
  cached = store
  return store
}

function invalid(path: string, issues: string): Error {
  return new Error(`[${path}] 양식이 맞지 않음: ${issues}`)
}

/** 경로의 양식으로 검사한 값 */
export function validate(path: string, value: unknown): unknown {
  const { schema } = resolve(path)
  const r = schema.safeParse(value)
  if (!r.success)
    throw invalid(
      path,
      r.error.issues
        .map((i) => `${i.path.join('.') || '(값)'}: ${i.message}`)
        .join('; '),
    )
  return r.data
}

async function mustExist(store: Firestore, path: string, why: string) {
  if (!(await store.doc(path).get()).exists)
    throw new Error(`${why}: ${path} 이 없다`)
}

/** 다른 문서를 가리키는 값이 실제로 있는지 */
async function checkRefs(
  store: Firestore,
  kind: Kind,
  program: string | undefined,
  data: Record<string, unknown>,
): Promise<void> {
  if (program && kind !== 'program')
    await mustExist(store, `programs/${program}`, '사업 카드 먼저')
  if (kind === 'program' && data.parent)
    await mustExist(store, `programs/${String(data.parent)}`, '상위 사업 먼저')
  if (kind === 'fact' && data.material)
    await mustExist(store, `materials/${String(data.material)}`, '자료 먼저')
  if (kind === 'fact')
    for (const f of (data.derivedFrom ?? []) as Array<string>)
      await mustExist(store, `programs/${program}/facts/${f}`, '근거 사실 먼저')
  if (kind === 'review')
    await mustExist(
      store,
      `programs/${program}/reports/${String(data.report)}`,
      '검증할 리포트',
    )
  if (kind === 'material')
    for (const p of data.programs as Array<string>)
      await mustExist(store, `programs/${p}`, '자료가 가리키는 사업')
  if (kind === 'task' && data.program)
    await mustExist(store, `programs/${String(data.program)}`, '작업 대상 사업')
  if (kind === 'report') loadReportDoc(String(data.markdown))
}

/** 양식·참조를 검사하고 문서를 통째로 쓴다 */
export async function put(path: string, value: unknown): Promise<void> {
  const data = validate(path, value) as Record<string, unknown>
  const { kind, program } = resolve(path)
  const store = db()
  await checkRefs(store, kind, program, data)
  await store.doc(path).set(data)
}

export async function get(path: string): Promise<unknown> {
  resolve(path)
  const snap = await db().doc(path).get()
  return snap.exists ? snap.data() : undefined
}

export async function list(
  collection: string,
): Promise<Array<{ id: string; data: unknown }>> {
  if (!isCollection(collection))
    throw new Error(`정해지지 않은 컬렉션: ${collection}`)
  const snap = await db().collection(collection).get()
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }))
}

/**
 * 자료 파일 내용. 로컬(resources/ …)에 있으면 그것을, 없으면 같은 경로의 Storage 객체를 읽는다.
 * 클라우드 실행에는 로컬 사본이 없으므로 GLASSES_STORAGE_BUCKET을 정해 둔다.
 */
export async function readMaterialFile(file: string): Promise<Buffer> {
  if (existsSync(file)) return readFileSync(file)
  const bucket = process.env.GLASSES_STORAGE_BUCKET
  if (!bucket)
    throw new Error(
      `로컬에 없는 자료 파일: ${file} (GLASSES_STORAGE_BUCKET을 정하면 Storage에서 읽는다)`,
    )
  const [bytes] = await getStorage(app()).bucket(bucket).file(file).download()
  return bytes
}
