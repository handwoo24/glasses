import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { CHUNK_BYTES, decodeSnapshot, encodeSnapshot } from './snapshot'
import type { DirectoryData } from './snapshot'

const data: DirectoryData = {
  orgs: [
    {
      id: '3940000',
      org: {
        name: '고양시',
        type: '기초자치단체',
        slug: 'goyang',
        sourceHosts: [],
        updatedAt: '2026-10-29',
      },
    },
  ],
  cards: [
    {
      id: '3940000.bus-depot-wondang',
      name: '원당 버스공영차고지',
      org: '3940000',
      region: '41281',
    },
  ],
  budgetDocs: [],
  summaries: [],
}

describe('검색 스냅샷 인코딩', () => {
  test('조각으로 나눴다 합치면 같은 값이 돌아온다', () => {
    const chunks = encodeSnapshot(data)

    expect(decodeSnapshot(chunks)).toEqual(data)
  })

  test('조각 하나는 Firestore 문서 한도 안의 크기다', () => {
    const many: DirectoryData = {
      ...data,
      // 압축이 잘 안 되도록 이름마다 무작위 글자를 넣는다
      cards: Array.from({ length: 40_000 }, (_, i) => ({
        id: `3940000.p${i.toString(36)}`,
        name: `사업 ${randomUUID()}`,
        org: '3940000',
      })),
    }

    const chunks = encodeSnapshot(many)

    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks)
      expect(c.byteLength).toBeLessThanOrEqual(CHUNK_BYTES)
    expect(decodeSnapshot(chunks).cards).toHaveLength(40_000)
  })

  test('양식이 맞지 않는 스냅샷은 읽지 않는다', () => {
    const broken = encodeSnapshot({
      ...data,
      cards: [{ id: 'x' } as unknown as DirectoryData['cards'][number]],
    })

    expect(() => decodeSnapshot(broken)).toThrow()
  })
})
