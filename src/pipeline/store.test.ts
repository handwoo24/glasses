// 에뮬레이터가 떠 있을 때만 돈다: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npx vitest run src/pipeline
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { claim, done, enqueue, fail } from './queue'
import { db, get, put } from './store'

const RUN = Date.now().toString(36)
const PROGRAM = `test.run-${RUN}`
const MATERIAL = `m-${RUN.padStart(12, '0')
  .slice(-12)
  .replace(/[^0-9a-f]/g, 'a')}`
const today = '2026-10-28'

const program = {
  name: '테스트 사업',
  org: 'test',
  status: '진행 중',
  priority: { score: 'low', why: '테스트' },
  updatedAt: today,
}
const material = {
  title: '테스트 자료',
  org: '고양특례시',
  kind: '계약정보',
  url: 'https://www.goyang.go.kr/contract/basis/situationList.do',
  publishedAt: today,
  fetchedAt: today,
  sha256: 'a'.repeat(64),
  license: '공공기관 계약정보 공개',
  file: 'resources/test.json',
  programs: [PROGRAM],
}
const fact = {
  claim: '계약 금액은 1억 원이다',
  kind: '수치',
  value: 100_000_000,
  unit: 'krw',
  material: MATERIAL,
  locator: '계약번호 1',
  quote: '"ctrtAmt": 100000000',
  recordedAt: today,
}

// 두 describe가 모두 끝난 뒤 이번 실행이 만든 데이터를 지운다
afterAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return
  const store = db()
  await store.recursiveDelete(store.doc(`programs/${PROGRAM}`))
  await store.recursiveDelete(store.doc(`materials/${MATERIAL}`))
  const tasks = await store
    .collection('tasks')
    .where('program', '==', PROGRAM)
    .get()
  await Promise.all(tasks.docs.map((d) => d.ref.delete()))
})

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  '저장 (에뮬레이터)',
  () => {
    test('양식이 틀린 문서는 쓰지 않는다', async () => {
      await expect(
        put(`programs/${PROGRAM}`, { ...program, status: '아마도' }),
      ).rejects.toThrow('양식이 맞지 않음')
      expect(await get(`programs/${PROGRAM}`)).toBeUndefined()
    })

    test('가리키는 문서가 없으면 쓰지 않는다', async () => {
      await expect(put(`materials/${MATERIAL}`, material)).rejects.toThrow(
        '자료가 가리키는 사업',
      )
      await put(`programs/${PROGRAM}`, program)
      await expect(put(`programs/${PROGRAM}/facts/f1`, fact)).rejects.toThrow(
        '자료 먼저',
      )
      await put(`materials/${MATERIAL}`, material)
      await put(`programs/${PROGRAM}/facts/f1`, fact)
      expect(await get(`programs/${PROGRAM}/facts/f1`)).toMatchObject({
        value: 100_000_000,
      })
    })

    test('계산된 사실은 근거 사실이 있어야 쓴다', async () => {
      const derived = {
        claim: '두 배',
        kind: '수치',
        derivedFrom: ['f9'],
        formula: 'f9 * 2',
        recordedAt: today,
      }
      await expect(
        put(`programs/${PROGRAM}/facts/f2`, derived),
      ).rejects.toThrow('근거 사실 먼저')
    })

    test('리포트는 리포트 문서 양식 검사를 통과해야 쓴다', async () => {
      const record = (markdown: string) => ({
        markdown,
        status: 'draft',
        updatedAt: '2026-10-28T10:00:00+09:00',
      })
      await expect(
        put(
          `programs/${PROGRAM}/reports/2026-10-27`,
          record('# 제목만 있는 글'),
        ),
      ).rejects.toThrow('머리말')
      const md = readFileSync(
        'src/content/reports/autonomous-bus-dallil-goyang.md',
        'utf8',
      )
      await put(`programs/${PROGRAM}/reports/2026-10-27`, record(md))
    })
  },
)

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  '작업 큐 (에뮬레이터)',
  () => {
    const t0 = new Date('2026-10-28T01:00:00Z')

    test('가져간 작업은 lease 동안 다시 가져갈 수 없고, lease가 지나면 다시 가져간다', async () => {
      await put(`programs/${PROGRAM}`, program)
      const id = await enqueue(
        'verify',
        PROGRAM,
        [`programs/${PROGRAM}/reports/2026-10-27`],
        t0,
      )
      const first = await claim('verify', 30, t0, PROGRAM)
      expect(first).toMatchObject({
        id,
        task: { status: 'running', attempt: 1 },
      })
      expect(
        await claim(
          'verify',
          30,
          new Date(t0.getTime() + 10 * 60_000),
          PROGRAM,
        ),
      ).toBeUndefined()
      const again = await claim(
        'verify',
        30,
        new Date(t0.getTime() + 31 * 60_000),
        PROGRAM,
      )
      expect(again).toMatchObject({ id, task: { attempt: 2 } })
    })

    test('실패하면 다시 큐로 돌아가고, 끝내면 산출물이 남고 lease가 지워진다', async () => {
      const id = await enqueue('assess-write', PROGRAM, [], t0)
      await claim('assess-write', 30, t0, PROGRAM)
      expect(await fail(id, '양식 오류')).toMatchObject({
        status: 'queued',
        error: '양식 오류',
      })
      await claim('assess-write', 30, t0, PROGRAM)
      const finished = await done(id, [
        `programs/${PROGRAM}/reports/2026-10-27`,
      ])
      expect(finished).toMatchObject({
        status: 'done',
        outputs: [`programs/${PROGRAM}/reports/2026-10-27`],
      })
      expect(await get(`tasks/${id}`)).not.toHaveProperty('leaseUntil')
      expect(await get(`tasks/${id}`)).not.toHaveProperty('error')
    })
  },
)
