import { describe, expect, test } from 'vitest'
import {
  SIDO_TILES,
  ministryGroup,
  pickSido,
  sidoOfAddress,
  sidoStats,
  toneOf,
} from './regions'
import type { ListedReport } from './list'
import type { DirOrg } from './server/directory.server'

const org = (o: Partial<DirOrg> & Pick<DirOrg, 'id' | 'name'>): DirOrg => ({
  type: '기초자치단체',
  cards: 0,
  published: 0,
  ...o,
})

const report = (
  region: string,
  overall: ListedReport['overall'],
): ListedReport =>
  ({ region, overall, org: 'x', ministries: [] }) as unknown as ListedReport

describe('시도 타일', () => {
  test('17개 시도가 서로 다른 칸에 놓인다', () => {
    const cells = Object.values(SIDO_TILES).map((t) => `${t.col},${t.row}`)

    expect(Object.keys(SIDO_TILES)).toHaveLength(17)
    expect(new Set(cells).size).toBe(17)
  })
})

describe('시도별 집계', () => {
  test('기관·카드·평가와 판정 분포를 시도 코드 두 자리로 묶는다', () => {
    const orgs = [
      org({
        id: '6410000',
        name: '경기도',
        type: '광역자치단체',
        region: '41',
        cards: 86,
      }),
      org({
        id: '3940000',
        name: '고양특례시',
        region: '41280',
        cards: 76,
        published: 2,
      }),
      org({
        id: '6110000',
        name: '서울특별시',
        type: '광역자치단체',
        region: '11',
        cards: 212,
      }),
      org({
        id: '1613000',
        name: '국토교통부',
        type: '중앙행정기관',
        cards: 49,
      }),
    ]
    const reports = [report('41280', 'fix'), report('41280', 'watch')]

    const stats = sidoStats(orgs, reports)

    expect(stats['41']).toEqual({
      orgs: 2,
      cards: 162,
      published: 2,
      verdicts: { fix: 1, watch: 1, 'on-track': 0, unknown: 0 },
    })
    expect(stats['11'].cards).toBe(212)
    expect(stats['26'].orgs).toBe(0)
  })

  test('타일 색: 목록 전, 평가 전, 개선 필요가 절반 넘음, 그 밖', () => {
    const none = { fix: 0, watch: 0, 'on-track': 0, unknown: 0 }

    expect(toneOf({ orgs: 0, cards: 0, published: 0, verdicts: none })).toBe(
      'empty',
    )
    expect(toneOf({ orgs: 1, cards: 5, published: 0, verdicts: none })).toBe(
      'list',
    )
    expect(
      toneOf({
        orgs: 1,
        cards: 5,
        published: 3,
        verdicts: { ...none, fix: 2, watch: 1 },
      }),
    ).toBe('hot')
    expect(
      toneOf({
        orgs: 1,
        cards: 5,
        published: 2,
        verdicts: { ...none, fix: 1, watch: 1 },
      }),
    ).toBe('warm')
  })

  test('고른 시도가 없으면 평가가 가장 많은 시도, 그다음 카드가 많은 시도', () => {
    const none = { fix: 0, watch: 0, 'on-track': 0, unknown: 0 }
    const stats = {
      ...sidoStats([], []),
      '11': { orgs: 1, cards: 212, published: 0, verdicts: none },
      '41': { orgs: 4, cards: 162, published: 10, verdicts: none },
    }

    expect(pickSido(stats, undefined)).toBe('41')
    expect(pickSido(stats, '11')).toBe('11')
    expect(
      pickSido({ ...stats, '41': { ...stats['41'], published: 0 } }, undefined),
    ).toBe('11')
  })
})

describe('부처 묶음', () => {
  test('이름 끝과 기관 종류로 부·청·처와 위원회·그 밖으로 나눈다', () => {
    expect(
      ministryGroup(org({ id: '1', name: '국토교통부', type: '중앙행정기관' })),
    ).toBe('bu')
    expect(
      ministryGroup(org({ id: '2', name: '방위사업청', type: '중앙행정기관' })),
    ).toBe('cheong')
    expect(
      ministryGroup(
        org({ id: '3', name: '대통령경호처', type: '중앙행정기관' }),
      ),
    ).toBe('cheo')
    expect(
      ministryGroup(org({ id: '4', name: '금융위원회', type: '중앙행정기관' })),
    ).toBe('cheo')
    expect(
      ministryGroup(
        org({ id: '5', name: '중앙선거관리위원회', type: '헌법기관' }),
      ),
    ).toBe('other')
    expect(
      ministryGroup(
        org({
          id: '6',
          name: '국무조정실 및 국무총리비서실',
          type: '중앙행정기관',
        }),
      ),
    ).toBe('other')
  })
})

describe('주소 → 시도', () => {
  test('정식 이름, 줄인 이름, 옛 이름을 읽는다', () => {
    expect(sidoOfAddress('경기도 고양시 일산동구')).toBe('41')
    expect(sidoOfAddress('서울특별시 중구')).toBe('11')
    expect(sidoOfAddress('서울 강남구')).toBe('11')
    expect(sidoOfAddress('강원도 춘천시')).toBe('51')
    expect(sidoOfAddress('전라북도 전주시')).toBe('52')
    expect(sidoOfAddress('충청남도 천안시')).toBe('44')
    expect(sidoOfAddress('')).toBeUndefined()
    expect(sidoOfAddress(undefined)).toBeUndefined()
  })
})
