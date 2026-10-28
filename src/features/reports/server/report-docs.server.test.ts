// 에뮬레이터가 떠 있을 때만 돈다: FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 npx vitest run src/features/reports/server
import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { db, put } from '#/pipeline/store'
import { getReportDoc, publishedDocs } from './report-docs.server'

const RUN = Date.now().toString(36)
const ORG = `alio-site${RUN}`
const PROGRAM = `programs/${ORG}.run`
const REPORT = `${PROGRAM}/reports/2026-10-27`
const SLUG = `site-${RUN}`
const md = readFileSync(
  'src/features/reports/doc/__fixtures__/autonomous-bus.md',
  'utf8',
).replace('slug: autonomous-bus-dallil-goyang', `slug: ${SLUG}`)

afterAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return
  const store = db()
  for (const path of [PROGRAM, `orgs/${ORG}`, `published/${SLUG}`])
    await store.recursiveDelete(store.doc(path))
})

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  '게시 리포트 읽기 (에뮬레이터)',
  () => {
    test('published가 가리키는 리포트를 읽어 화면 데이터로 만든다', async () => {
      await put(`orgs/${ORG}`, {
        name: '사이트 테스트',
        type: '공공기관',
        slug: 'site',
        updatedAt: '2026-10-28',
      })
      await put(PROGRAM, {
        name: '테스트 사업',
        org: ORG,
        status: '진행 중',
        priority: { score: 'low', why: '테스트' },
        updatedAt: '2026-10-28',
      })
      const now = '2026-10-28T10:00:00+09:00'
      await put(REPORT, { markdown: md, status: 'published', updatedAt: now })
      await put(`published/${SLUG}`, {
        report: REPORT,
        subject: PROGRAM,
        order: 99,
        publishedAt: now,
      })

      const doc = await getReportDoc(SLUG)
      expect(doc?.title).toBe('자율주행버스 ‘달릴고양’')
      expect(doc?.subject).toBe(PROGRAM)
      expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
      expect((await publishedDocs()).at(-1)?.slug).toBe(SLUG)
      expect(await getReportDoc('nope')).toBeUndefined()
    })
  },
)
