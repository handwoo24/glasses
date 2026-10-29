import { describe, expect, test } from 'vitest'
import { programsToList, sortVendorWork } from './vendor-worklist'
import type { VendorWork } from './vendor-worklist'

describe('업체 목록화가 남은 사업', () => {
  test('게시된 사업 가운데 아직 목록화하지 않은 것만, 게시 순서대로', () => {
    const published = [
      { subject: 'programs/3940000.b', order: 2 },
      { subject: 'programs/3940000.a', order: 1 },
      { subject: 'orgs/3940000/budgets/2026-original', order: 3 },
      { subject: 'programs/3940000.c', order: 4 },
    ]
    const listed = new Set(['programs/3940000.c'])
    expect(programsToList(published, listed)).toEqual([
      'programs/3940000.a',
      'programs/3940000.b',
    ])
  })
})

describe('업체 작업 순서', () => {
  const work = (over: Partial<VendorWork>): VendorWork => ({
    path: 'programs/3940000.a/vendors/1111111111',
    name: '업체',
    role: '유지보수',
    amount: 100_000_000,
    priority: 'medium',
    stage: '대기',
    ...over,
  })

  test('고침 → 검증 → 이어 하기 → 대기, 같은 단계면 우선순위·금액 순', () => {
    const sorted = sortVendorWork([
      work({ path: 'p/1', stage: '대기', priority: 'high' }),
      work({ path: 'p/2', stage: '검증' }),
      work({ path: 'p/3', stage: '고침' }),
      work({ path: 'p/4', stage: '대기', priority: 'high', amount: 9e9 }),
      work({ path: 'p/5', stage: '분석' }),
      work({ path: 'p/6', stage: '게시' }),
    ])
    expect(sorted.map((w) => w.path)).toEqual([
      'p/3',
      'p/2',
      'p/5',
      'p/4',
      'p/1',
      'p/6',
    ])
  })
})
