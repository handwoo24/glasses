// 에뮬레이터가 떠 있을 때만 돈다: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npx vitest run src/features/directory
import { describe, expect, test } from 'vitest'
import { db, put } from '#/pipeline/store'
import { directoryData, writeSnapshot } from './snapshot.server'

const RUN = Date.now().toString(36)
const ORG = `alio-snap${RUN}`

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('목록 스냅샷', () => {
  test('스냅샷이 없으면 원본을 직접 읽는다', async () => {
    await db().recursiveDelete(db().doc('meta/directory'))
    // 다른 테스트 파일이 같은 에뮬레이터에 동시에 쓰므로 전체 비교 대신 방금 쓴 기관이 바로 보이는지 본다
    await put(`orgs/${ORG}`, {
      name: '스냅샷 시험 기관',
      type: '공공기관',
      slug: 'snap',
      updatedAt: '2026-10-29',
    })

    const data = await directoryData(Date.now())

    expect(data.orgs.some((o) => o.id === ORG)).toBe(true)
  })

  test('쓴 스냅샷을 서버가 버전으로 받아 읽는다', async () => {
    await put(`orgs/${ORG}`, {
      name: '스냅샷 시험 기관',
      type: '공공기관',
      slug: 'snap',
      updatedAt: '2026-10-29',
    })
    await put(`programs/${ORG}.run`, {
      name: '스냅샷 시험 사업',
      org: ORG,
      status: '진행 중',
      priority: { score: 'low', why: '테스트' },
      updatedAt: '2026-10-29',
    })

    const built = await writeSnapshot()
    // TTL을 넘긴 시각으로 불러 버전을 다시 확인하게 한다
    const data = await directoryData(Date.now() + 120_000)

    expect(built.chunks).toBeGreaterThan(0)
    expect(data.orgs.some((o) => o.id === ORG)).toBe(true)
    expect(data.cards.find((c) => c.id === `${ORG}.run`)?.name).toBe(
      '스냅샷 시험 사업',
    )
  })

  test('지난 조각은 유예가 지난 것만 지운다', async () => {
    const chunks = db().collection('meta/directory/chunks')
    const old = Date.now() - 60 * 60_000
    await chunks.doc(`${old}-0`).set({ bytes: Buffer.from('x') })
    const recent = await writeSnapshot()

    await writeSnapshot()
    const left = (await chunks.listDocuments()).map((r) => r.id)

    expect(left).not.toContain(`${old}-0`)
    expect(left).toContain(`${recent.version}-0`)
  })

  test('더 늦은 버전이 올라가 있으면 덮지 않는다', async () => {
    const later = Date.now() + 60_000
    await db()
      .doc('meta/directory')
      .set({ version: later, chunks: 1, builtAt: new Date().toISOString() })

    await writeSnapshot()
    const pointer = await db().doc('meta/directory').get()

    expect(pointer.get('version')).toBe(later)
    await db().doc('meta/directory').delete()
  })
})
