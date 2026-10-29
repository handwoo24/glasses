import { describe, expect, it } from 'vitest'
import { VendorsSearchSchema, filterVendors, vendorSidoCounts } from './list'
import type { Engagement, VendorListItem } from './list'

function eng(org: string, region: string, amount: number): Engagement {
  return {
    program: `programs/${org}.x`,
    programName: '사업',
    org,
    orgName: org,
    region,
    role: '용역',
    amount,
    contracts: 1,
    stage: '대기',
    summary: null,
    verdict: null,
  }
}

const items: Array<VendorListItem> = [
  {
    bizno: '1234567890',
    name: '주식회사 가나',
    home: '경기도 고양시 일산동구',
    engagements: [eng('3940000', '41280', 3e9)],
    amount: 3e9,
  },
  {
    bizno: '2223334445',
    name: '다라 주식회사',
    home: '서울특별시 중구',
    engagements: [eng('6110000', '11', 1e9), eng('3940000', '41280', 1e9)],
    amount: 2e9,
  },
  {
    bizno: '9998887776',
    name: '마바',
    engagements: [{ ...eng('6110000', '11', 5e8), verdict: 'watch' }],
    amount: 5e8,
  },
]

const names = (s: Parameters<typeof filterVendors>[1]) =>
  filterVendors(items, s).map((v) => v.name)

describe('용역 목록', () => {
  it('기본은 계약 금액 큰 순', () => {
    expect(names({})).toEqual(['주식회사 가나', '다라 주식회사', '마바'])
  })
  it('지역은 참여 사업 기관의 시도로 고른다', () => {
    expect(names({ region: '41' })).toEqual(['주식회사 가나', '다라 주식회사'])
  })
  it('판정은 게시된 업체 리포트가 있는 업체만', () => {
    expect(names({ verdict: 'watch' })).toEqual(['마바'])
  })
  it('이름이나 사업자등록번호 일부로 찾는다', () => {
    expect(names({ q: '다라' })).toEqual(['다라 주식회사'])
    expect(names({ q: '222-333' })).toEqual(['다라 주식회사'])
  })
  it('참여 사업 많은 순', () => {
    expect(names({ sort: 'programs' })[0]).toBe('다라 주식회사')
  })
  it('주소 조건: 숫자로 읽힌 코드, 틀린 값은 버림', () => {
    expect(
      VendorsSearchSchema.parse({ region: 11, org: 3940000, page: '2' }),
    ).toEqual({ region: '11', org: '3940000', page: 2 })
    expect(VendorsSearchSchema.parse({ sort: 'x', q: '  ' })).toEqual({})
  })
})

describe('용역 지도', () => {
  it('본사 소재지 시도로 고른다', () => {
    expect(names({ home: '41' })).toEqual(['주식회사 가나'])
    expect(names({ home: '11' })).toEqual(['다라 주식회사'])
  })
  it('소재지 기준은 업체마다 한 번, 발주 기관 기준은 시도마다 한 번 센다', () => {
    expect(vendorSidoCounts(items, 'home')).toEqual({ '41': 1, '11': 1 })
    expect(vendorSidoCounts(items, 'org')).toEqual({ '41': 2, '11': 2 })
  })
  it('지도 기준은 소재지가 기본이고 모르는 값은 버린다', () => {
    expect(VendorsSearchSchema.parse({ by: 'org', home: 41 })).toMatchObject({
      by: 'org',
      home: '41',
    })
    expect(VendorsSearchSchema.parse({ by: 'x' }).by).toBeUndefined()
  })
})
