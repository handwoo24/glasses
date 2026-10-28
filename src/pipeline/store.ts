// 파이프라인 산출물 읽기·쓰기. 쓰기 전에 양식과 참조(가리키는 문서가 있는지)를 검사한다.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { loadReportDoc } from '#/features/reports/doc/load'
import { lintReportDoc } from '#/features/reports/doc/lint'
import { isCollection, resolve } from './paths'
import type { Kind } from './paths'
import { ReportRecordSchema } from './schemas'

const DEFAULT_PROJECT = 'demo-glasses'
let cached: Firestore | undefined

function app() {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: process.env.GLASSES_FIRESTORE_PROJECT ?? DEFAULT_PROJECT,
    })
  )
}

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

/** 경로의 양식으로 검사한 값 */
export function validate(path: string, value: unknown): unknown {
  const { schema } = resolve(path)
  const r = schema.safeParse(value)
  if (!r.success)
    throw new Error(
      `[${path}] 양식이 맞지 않음: ${r.error.issues
        .map((i) => `${i.path.join('.') || '(값)'}: ${i.message}`)
        .join('; ')}`,
    )
  return r.data
}

async function mustExist(store: Firestore, path: string, why: string) {
  if (!(await store.doc(path).get()).exists)
    throw new Error(`${why}: ${path} 이 없다`)
}

/** 리포트는 리포트 문서 양식과 문장 규칙을 통과해야 쓴다 */
function checkReport(markdown: string): void {
  const problems = lintReportDoc(loadReportDoc(markdown))
  if (problems.length)
    throw new Error(`리포트 문장 규칙 위반:\n  ${problems.join('\n  ')}`)
}

async function checkPublished(
  store: Firestore,
  slug: string,
  data: Record<string, unknown>,
) {
  const report = String(data.report)
  const { kind, parent } = resolve(report)
  if (kind !== 'report' || parent !== data.subject)
    throw new Error(`게시할 리포트는 ${String(data.subject)}/reports/{기준일}`)
  const snap = await store.doc(report).get()
  if (!snap.exists) throw new Error(`게시할 리포트가 없다: ${report}`)
  const record = ReportRecordSchema.parse(snap.data())
  if (record.status !== 'published')
    throw new Error(`status가 published인 리포트만 게시한다: ${report}`)
  const docSlug = loadReportDoc(record.markdown).slug
  if (docSlug !== slug)
    throw new Error(
      `게시 주소(${slug})와 리포트 머리말의 slug(${docSlug})가 다르다`,
    )
}

/** 다른 문서를 가리키는 값이 실제로 있는지 */
async function checkRefs(
  store: Firestore,
  path: string,
  kind: Kind,
  parent: string | undefined,
  data: Record<string, unknown>,
): Promise<void> {
  const refs = (field: string): Array<string> =>
    (data[field] as Array<string> | undefined) ?? []
  if (parent) await mustExist(store, parent, '상위 문서 먼저')
  if (kind === 'program' || kind === 'budgetLine')
    await mustExist(store, `orgs/${String(data.org)}`, '기관 먼저')
  const program = kind === 'program' ? data.parent : data.program
  if ((kind === 'program' || kind === 'budgetLine') && program)
    await mustExist(store, `programs/${String(program)}`, '사업 먼저')
  if (kind === 'fact' && data.material)
    await mustExist(store, `materials/${String(data.material)}`, '자료 먼저')
  if (kind === 'fact')
    for (const f of refs('derivedFrom'))
      await mustExist(store, `${parent}/facts/${f}`, '근거 사실 먼저')
  if (kind === 'review')
    await mustExist(
      store,
      `${parent}/reports/${String(data.report)}`,
      '검증할 리포트',
    )
  if (kind === 'material') {
    for (const o of refs('about'))
      await mustExist(store, `orgs/${o}`, '자료가 다루는 기관')
    for (const s of refs('subjects'))
      await mustExist(store, s, '자료가 쓰이는 평가 대상')
  }
  if (kind === 'task' && data.subject)
    await mustExist(store, String(data.subject), '작업 대상')
  if (kind === 'report') checkReport(String(data.markdown))
  if (kind === 'published')
    await checkPublished(store, path.split('/')[1], data)
}

/** 양식·참조를 검사하고 문서를 통째로 쓴다 */
export async function put(path: string, value: unknown): Promise<void> {
  const data = validate(path, value) as Record<string, unknown>
  const { kind, parent } = resolve(path)
  const store = db()
  await checkRefs(store, path, kind, parent, data)
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

/** 로컬 사본 위치: Storage와 같은 경로로 .storage/ 아래에 둔다 */
const MIRROR = process.env.GLASSES_STORAGE_MIRROR ?? '.storage'

/**
 * 자료 파일 내용(materials/{자료 id}/…). 로컬 사본이 있으면 그것을, 없으면 Storage 객체를 읽는다.
 * 클라우드 실행에는 로컬 사본이 없으므로 GLASSES_STORAGE_BUCKET을 정해 둔다.
 */
export async function readMaterialFile(file: string): Promise<Buffer> {
  const local = join(MIRROR, file)
  if (existsSync(local)) return readFileSync(local)
  const bucket = process.env.GLASSES_STORAGE_BUCKET
  if (!bucket)
    throw new Error(
      `로컬 사본에 없는 자료 파일: ${local} (GLASSES_STORAGE_BUCKET을 정하면 Storage에서 읽는다)`,
    )
  const [bytes] = await getStorage(app()).bucket(bucket).file(file).download()
  return bytes
}
