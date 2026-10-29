import { describe, expect, it } from 'vitest'
import {
  NO_DEPT,
  WorklistSearchSchema,
  deptGroups,
  eok,
  filterItems,
  stageCounts,
} from './list'
import type { WorkItem } from './server/worklist.server'

function item(id: string, patch: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    name: id,
    departments: [],
    priority: 'medium',
    priorityWhy: '',
    budget: null,
    stage: '대기',
    materials: 0,
    facts: 0,
    absences: 0,
    latestReport: null,
    summary: null,
    ...patch,
  }
}

const won = (eokValue: number, rate = 1) => ({
  year: 2026,
  amount: eokValue * 1e8,
  spent: eokValue * 1e8 * rate,
})

const items = [
  item('road', {
    departments: ['공사과'],
    budget: won(61, 0.12),
    priority: 'high',
  }),
  item('kintex', {
    departments: ['전략산업과'],
    budget: won(450),
    priority: 'high',
  }),
  item('hub', {
    departments: ['스마트시티과'],
    budget: won(62, 0),
    stage: '수집',
    priority: 'high',
  }),
  item('bus', {
    departments: ['스마트시티과'],
    stage: '게시',
    priority: 'high',
  }),
  item('cluster', { budget: won(162, 0.2), priority: 'high' }),
  item('park', {
    departments: ['공사과'],
    budget: won(12),
    priority: 'low',
    stage: '고침',
  }),
]

describe('filterItems', () => {
  it('기본 정렬은 게시한 사업 먼저, 그다음 우선순위와 예산', () => {
    expect(filterItems(items, {}).map((i) => i.id)).toEqual([
      'bus',
      'kintex',
      'cluster',
      'hub',
      'road',
      'park',
    ])
  })

  it('부서 필터와 ‘부서 확인 전’', () => {
    expect(filterItems(items, { dept: '공사과' }).map((i) => i.id)).toEqual([
      'road',
      'park',
    ])
    expect(filterItems(items, { dept: NO_DEPT }).map((i) => i.id)).toEqual([
      'cluster',
    ])
  })

  it('‘작업 중’은 수집~검증 단계를 묶는다', () => {
    expect(filterItems(items, { stage: '작업 중' }).map((i) => i.id)).toEqual([
      'hub',
    ])
    expect(filterItems(items, { stage: '고침' }).map((i) => i.id)).toEqual([
      'park',
    ])
  })

  it('집행률 낮은 순은 예산 없는 사업을 뒤로', () => {
    expect(filterItems(items, { sort: 'rate' }).map((i) => i.id)).toEqual([
      'hub',
      'road',
      'cluster',
      'kintex',
      'park',
      'bus',
    ])
  })
})

describe('stageCounts · deptGroups', () => {
  it('단계마다 센다', () => {
    const c = stageCounts(items)
    expect([c['대기'], c['수집'], c['고침'], c['게시'], c['분석']]).toEqual([
      3, 1, 1, 1, 0,
    ])
  })

  it('사업 많은 부서 순, 같으면 예산 큰 순으로 묶고 부서 모르는 사업은 따로 센다', () => {
    const { groups, unknown } = deptGroups(items)
    expect(groups.map((g) => [g.name, g.count])).toEqual([
      ['공사과', 2],
      ['스마트시티과', 2],
      ['전략산업과', 1],
    ])
    expect(groups[1].stages['게시']).toBe(1)
    expect(unknown).toBe(1)
  })
})

describe('WorklistSearchSchema · eok', () => {
  it('모르는 검색 조건은 버린다', () => {
    expect(
      WorklistSearchSchema.parse({
        stage: '없는 단계',
        sort: 'x',
        dept: '공사과',
      }),
    ).toEqual({
      dept: '공사과',
    })
  })

  it('억 단위로 줄인다', () => {
    expect([eok(450e8), eok(3.2e8), eok(4500e4)]).toEqual([
      '450억',
      '3.2억',
      '4,500만',
    ])
  })
})
