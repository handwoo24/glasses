// 파이프라인 산출물 읽기·쓰기. 쓰기 전에 양식과 참조(가리키는 문서가 있는지)를 검사한다.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { loadReportDoc } from '#/features/reports/doc/load'
import { lintReportDoc } from '#/features/reports/doc/lint'
import { toSummary } from '#/features/reports/summary'
import type { ReportSummary } from '#/features/reports/summary'
import { lintVendorDoc } from '#/features/vendors/doc/lint'
import { loadVendorDoc } from '#/features/vendors/doc/load'
import { toVendorSummary } from '#/features/vendors/summary'
import type { VendorSummary } from '#/features/vendors/summary'
import { isCollection, resolve } from './paths'
import type { Kind } from './paths'
import { ReportRecordSchema, VENDOR_SUBJECT_PATH } from './schemas'

const DEFAULT_PROJECT = 'demo-glasses'
/**
 * 개발 서버가 이 모듈을 다시 읽어도(HMR) firebase-admin 앱은 남아 있다.
 * 이미 쓴 Firestore에 settings()를 다시 부르면 오류가 나므로 인스턴스를 전역에 둔다.
 */
const CACHE = Symbol.for('glasses.firestore')
const holder = globalThis as { [CACHE]?: Firestore }

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
  const cached = holder[CACHE]
  if (cached) return cached
  const store = getFirestore(app())
  // 선택 필드(undefined)는 쓰지 않는다. 문서를 통째로 쓸 때 빠진 필드는 지워진다
  store.settings({ ignoreUndefinedProperties: true })
  holder[CACHE] = store
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

/** 업체 리포트 머리말의 사업·사업자등록번호가 저장 경로와 같은지 */
export function checkVendorDocPath(
  doc: { program: string; bizno: string },
  subject: string,
): void {
  const [program, bizno] = subject.split('/vendors/')
  if (doc.program !== program || doc.bizno.replaceAll('-', '') !== bizno)
    throw new Error(
      `업체 리포트 머리말(${doc.program}, ${doc.bizno})이 저장 경로(${subject})와 다르다`,
    )
}

/** 리포트는 리포트 문서 양식과 문장 규칙을 통과해야 쓴다. 업체 평가 대상이면 업체 리포트 양식 */
function checkReport(markdown: string, subject: string | undefined): void {
  let problems: Array<string>
  if (subject && VENDOR_SUBJECT_PATH.test(subject)) {
    const doc = loadVendorDoc(markdown)
    checkVendorDocPath(doc, subject)
    problems = lintVendorDoc(doc)
  } else problems = lintReportDoc(loadReportDoc(markdown))
  if (problems.length)
    throw new Error(`리포트 문장 규칙 위반:\n  ${problems.join('\n  ')}`)
}

/** 게시 문서가 가리키는 리포트를 검사하고, 홈·목록용 요약을 돌려준다 */
async function checkPublished(
  store: Firestore,
  slug: string,
  data: Record<string, unknown>,
): Promise<ReportSummary> {
  const report = String(data.report)
  const { kind, parent } = resolve(report)
  if (kind !== 'report' || parent !== data.subject)
    throw new Error(`게시할 리포트는 ${String(data.subject)}/reports/{기준일}`)
  const snap = await store.doc(report).get()
  if (!snap.exists) throw new Error(`게시할 리포트가 없다: ${report}`)
  const record = ReportRecordSchema.parse(snap.data())
  if (record.status !== 'published')
    throw new Error(`status가 published인 리포트만 게시한다: ${report}`)
  const doc = loadReportDoc(record.markdown)
  if (doc.slug !== slug)
    throw new Error(
      `게시 주소(${slug})와 리포트 머리말의 slug(${doc.slug})가 다르다`,
    )
  return toSummary({ ...doc, subject: String(data.subject) })
}

/** 업체 게시 문서가 가리키는 업체 리포트를 검사하고, 목록용 요약을 돌려준다 */
async function checkPublishedVendor(
  store: Firestore,
  slug: string,
  data: Record<string, unknown>,
): Promise<VendorSummary> {
  const report = String(data.report)
  const { kind, parent } = resolve(report)
  if (kind !== 'report' || parent !== data.subject)
    throw new Error(`게시할 리포트는 ${String(data.subject)}/reports/{기준일}`)
  const snap = await store.doc(report).get()
  if (!snap.exists) throw new Error(`게시할 리포트가 없다: ${report}`)
  const record = ReportRecordSchema.parse(snap.data())
  if (record.status !== 'published')
    throw new Error(`status가 published인 리포트만 게시한다: ${report}`)
  const doc = loadVendorDoc(record.markdown)
  checkVendorDocPath(doc, String(data.subject))
  if (doc.slug !== slug)
    throw new Error(
      `게시 주소(${slug})와 리포트 머리말의 slug(${doc.slug})가 다르다`,
    )
  return toVendorSummary({ ...doc, subject: String(data.subject) })
}

/** 근거 사실: 같은 평가 대상의 f{n}이면 그 아래에서, 경로면 그 경로에서 찾는다 */
export function factPath(parent: string | undefined, ref: string): string {
  return ref.includes('/') ? ref : `${parent}/facts/${ref}`
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
      await mustExist(store, factPath(parent, f), '근거 사실 먼저')
  if (kind === 'vendorCard')
    await mustExist(
      store,
      `vendors/${path.split('/').at(-1)}`,
      '업체 레지스트리 먼저',
    )
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
  if (kind === 'report') checkReport(String(data.markdown), parent)
}

/** 양식·참조를 검사하고 문서를 통째로 쓴다 */
export async function put(path: string, value: unknown): Promise<void> {
  const data = validate(path, value) as Record<string, unknown>
  const { kind, parent } = resolve(path)
  const store = db()
  await checkRefs(store, path, kind, parent, data)
  // 게시 문서에는 홈·목록용 요약을 리포트에서 계산해 함께 쓴다
  const slug = path.split('/')[1]
  const out =
    kind === 'published'
      ? { ...data, summary: await checkPublished(store, slug, data) }
      : kind === 'publishedVendor'
        ? { ...data, summary: await checkPublishedVendor(store, slug, data) }
        : data
  await store.doc(path).set(out)
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
