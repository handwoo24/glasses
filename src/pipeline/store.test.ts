// 에뮬레이터가 떠 있을 때만 돈다: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npx vitest run src/pipeline
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { claim, done, enqueue, fail } from './queue'
import { db, get, put } from './store'

const RUN = Date.now().toString(36)
const ORG = `alio-test${RUN}`
const PROGRAM = `programs/${ORG}.run`
const MATERIAL = `m-${RUN.padStart(12, '0')
  .slice(-12)
  .replace(/[^0-9a-f]/g, 'a')}`
const REPORT = `${PROGRAM}/reports/2026-10-27`
const today = '2026-10-28'
const now = '2026-10-28T10:00:00+09:00'
// 실제 게시 주소와 겹치지 않게 slug를 실행마다 바꾼다
const md = readFileSync(
  'src/features/reports/doc/__fixtures__/autonomous-bus.md',
  'utf8',
).replace('slug: autonomous-bus-dallil-goyang', `slug: test-${RUN}`)

const org = {
  name: '테스트 기관',
  type: '공공기관',
  slug: 'test',
  updatedAt: today,
}
const program = {
  name: '테스트 사업',
  org: ORG,
  status: '진행 중',
  priority: { score: 'low', why: '테스트' },
  updatedAt: today,
}
const material = {
  title: '테스트 자료',
  kind: '계약정보',
  publisher: '고양특례시',
  url: 'https://www.goyang.go.kr/contract/basis/situationList.do',
  fetchedAt: today,
  sha256: 'a'.repeat(64),
  files: { original: `materials/${MATERIAL}/original.json` },
  about: [ORG],
  subjects: [PROGRAM],
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
const record = (markdown: string, status = 'draft') => ({
  markdown,
  status,
  updatedAt: now,
})

// 두 describe가 모두 끝난 뒤 이번 실행이 만든 데이터를 지운다
afterAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return
  const store = db()
  for (const path of [
    PROGRAM,
    `orgs/${ORG}`,
    `materials/${MATERIAL}`,
    `published/test-${RUN}`,
  ])
    await store.recursiveDelete(store.doc(path))
  const tasks = await store
    .collection('tasks')
    .where('subject', '==', PROGRAM)
    .get()
  await Promise.all(tasks.docs.map((d) => d.ref.delete()))
})

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  '저장 (에뮬레이터)',
  () => {
    test('양식이 틀린 문서는 쓰지 않는다', async () => {
      await expect(
        put(`orgs/${ORG}`, { ...org, type: '회사' }),
      ).rejects.toThrow('양식이 맞지 않음')
      expect(await get(`orgs/${ORG}`)).toBeUndefined()
    })

    test('가리키는 문서가 없으면 쓰지 않는다: 기관 → 사업 → 자료 → 사실', async () => {
      await expect(put(PROGRAM, program)).rejects.toThrow('기관 먼저')
      await put(`orgs/${ORG}`, org)
      await expect(put(`materials/${MATERIAL}`, material)).rejects.toThrow(
        '자료가 쓰이는 평가 대상',
      )
      await put(PROGRAM, program)
      await expect(put(`${PROGRAM}/facts/f1`, fact)).rejects.toThrow(
        '자료 먼저',
      )
      await put(`materials/${MATERIAL}`, material)
      await put(`${PROGRAM}/facts/f1`, fact)
      expect(await get(`${PROGRAM}/facts/f1`)).toMatchObject({
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
      await expect(put(`${PROGRAM}/facts/f2`, derived)).rejects.toThrow(
        '근거 사실 먼저',
      )
    })

    test('리포트는 문서 양식과 문장 규칙을 통과해야 쓴다', async () => {
      await expect(put(REPORT, record('# 제목만 있는 글'))).rejects.toThrow(
        '머리말',
      )
      const banned = md.replace(
        '공개되지 않았다.',
        '공개되지 않아 의혹이 있다.',
      )
      await expect(put(REPORT, record(banned))).rejects.toThrow(
        '문장 규칙 위반',
      )
      await put(REPORT, record(md))
    })

    test('게시는 published 상태이고 주소가 머리말 slug와 같은 리포트만 가리킨다', async () => {
      const published = {
        report: REPORT,
        subject: PROGRAM,
        order: 9,
        publishedAt: now,
      }
      await expect(put(`published/test-${RUN}`, published)).rejects.toThrow(
        'published인 리포트만',
      )
      await put(REPORT, record(md, 'published'))
      await expect(put(`published/other-${RUN}`, published)).rejects.toThrow(
        '머리말의 slug',
      )
      await put(`published/test-${RUN}`, published)
      // 게시할 때 홈·목록용 요약을 리포트에서 계산해 함께 쓴다
      const saved = (await get(`published/test-${RUN}`)) as {
        summary?: { subject?: string; title: string }
      }
      expect(saved.summary?.subject).toBe(PROGRAM)
      expect(saved.summary?.title).toBe('자율주행버스 ‘달릴고양’')
      await expect(
        put(`published/test-${RUN}`, {
          ...published,
          subject: `orgs/${ORG}/budgets/2026-original`,
        }),
      ).rejects.toThrow('게시할 리포트는')
    })
  },
)

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  '작업 큐 (에뮬레이터)',
  () => {
    const t0 = new Date('2026-10-28T01:00:00Z')

    test('가져간 작업은 lease 동안 다시 가져갈 수 없고, lease가 지나면 다시 가져간다', async () => {
      const id = await enqueue('verify', PROGRAM, [REPORT], t0)
      expect(await claim('verify', 30, t0, PROGRAM)).toMatchObject({
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
      expect(await done(id, [REPORT])).toMatchObject({
        status: 'done',
        outputs: [REPORT],
      })
      expect(await get(`tasks/${id}`)).not.toHaveProperty('leaseUntil')
      expect(await get(`tasks/${id}`)).not.toHaveProperty('error')
    })
  },
)
