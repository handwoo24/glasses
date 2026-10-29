import { describe, expect, it } from 'vitest'
import { findInBook, isAdminLine, kindOf, parseBudgetBook } from './budget-book'

// 고양시 2026 본예산서 세출 사업명세서 488쪽을 줄인 것 (글자 사이 공백은 PDF 추출 그대로)
const PAGE = `=== page 488 ===
부 서 : 체 육 정 책 과
정 책 : 체 육 발 전 및 저 변 확 대 ( 문 화 및 관 광 / 체 육 )
단 위 : 선 수 · 체 육 지 도 자 · 체 육 단 체 육 성 ( 단 위 : 천 원 )
전 년 도
부 서 ㆍ 정 책 ㆍ 단 위 ( 회 계 ) ㆍ 세 부 사 업 ㆍ 편 성 목 예 산 액 비 교 증 감
예 산 액
장 애 인 체 육 회 운 영 지 원 4 1 8 , 6 4 4 3 9 2 , 9 8 0 2 5 , 6 6 4
3 0 7 민 간 이 전 4 1 8 , 6 4 4 3 9 2 , 9 8 0 2 5 , 6 6 4
○ 장 애 인 체 육 회 운 영 지 원 4 1 8 , 6 4 4
。 인 건 비 3 4 2 , 0 0 0 , 0 0 0 원 3 4 2 , 0 0 0
생 활 체 육 활 성 화 4 , 3 0 3 , 2 8 0 4 , 8 2 2 , 8 6 2 △ 5 1 9 , 5 8 2
기 1 , 8 9 5 , 8 1 0
일 반 생 활 체 육 지 도 자 배 치 ( 활 동 지 원 ) 1 6 5 , 9 0 0 1 7 8 , 5 4 0 △ 1 2 , 6 4 0
기 6 7 , 0 4 8
3 0 7 민 간 이 전 1 6 5 , 9 0 0 1 7 8 , 5 4 0 △ 1 2 , 6 4 0

=== page 489 ===
부 서 : 자 원 순 환 과
정 책 : 폐 기 물 처 리 ( 환 경 / 폐 기 물 )
단 위 : 환 경 에 너 지 시 설 운 영 ( 단 위 : 천 원 )
부 서 ㆍ 정 책 ㆍ 단 위 ( 회 계 ) ㆍ 세 부 사 업 ㆍ 편 성 목 예 산 액 비 교 증 감
환 경 에 너 지 시 설 운 영 3 2 , 1 9 8 , 4 1 3 3 3 , 9 5 3 , 2 5 9 △ 1 , 7 5 4 , 8 4 6
환 경 에 너 지 시 설 운 영 1 8 , 5 2 8 , 3 1 6 2 1 , 0 6 7 , 5 1 4 △ 2 , 5 3 9 , 1 9 8
2 0 1 일 반 운 영 비 1 8 , 5 2 8 , 3 1 6 2 1 , 0 6 7 , 5 1 4 △ 2 , 5 3 9 , 1 9 8
`

describe('parseBudgetBook', () => {
  const lines = parseBudgetBook(PAGE)

  it('편성목이 뒤따르는 이름 줄을 세부사업으로 읽고 쪽 머리의 부서·정책을 붙인다', () => {
    expect(lines).toContainEqual({
      dept: '체육정책과',
      policy: '체육발전및저변확대(문화및관광/체육)',
      unit: '선수·체육지도자·체육단체육성',
      name: '장애인체육회운영지원',
    })
  })

  it('본문 중간에 나온 단위사업으로 바꿔 붙인다', () => {
    expect(
      lines.find((l) => l.name.startsWith('일반생활체육지도자'))?.unit,
    ).toBe('생활체육활성화')
  })

  it('단위사업과 이름이 같은 세부사업도 세부사업으로 읽는다', () => {
    expect(lines.filter((l) => l.name === '환경에너지시설운영')).toHaveLength(1)
  })

  it('산출 내역(○, 금액원)과 재원 줄은 사업으로 읽지 않는다', () => {
    expect(lines.map((l) => l.name)).toEqual([
      '장애인체육회운영지원',
      '일반생활체육지도자배치(활동지원)',
      '환경에너지시설운영',
    ])
  })
})

describe('findInBook', () => {
  const book = parseBudgetBook(PAGE)

  it('지방재정365 이름의 공백과 괄호 차이를 넘어 찾는다', () => {
    expect(findInBook('장애인체육회 운영지원', book)?.how).toBe('exact')
    expect(findInBook('일반생활체육지도자 배치', book)?.how).toBe('loose')
    expect(findInBook('없는 사업', book)).toBeNull()
  })
})

describe('isAdminLine · kindOf', () => {
  it('행정경비와 재무 거래를 사업에서 뺀다', () => {
    expect(isAdminLine('기본경비')).toBe(true)
    expect(isAdminLine('내부거래지출(신청사건립기금)')).toBe(true)
    expect(
      isAdminLine(
        'SNS 소통행정 추진',
        '행정운영경비(언론홍보담당관)(기타/기타)',
      ),
    ).toBe(true)
    expect(isAdminLine('탄현체육센터 건립')).toBe(false)
  })

  it('기관 이름 속 낱말로 성격을 잘못 정하지 않는다', () => {
    expect(kindOf('탄현체육센터 건립')).toBe('건설·조성')
    expect(kindOf('고양도시관리공사 운영 지원')).toBe('출연·위탁')
    expect(kindOf('공공체육시설 대행사업')).toBe('기타')
    expect(kindOf('기초연금 지급')).toBe('현금·보조')
  })
})
