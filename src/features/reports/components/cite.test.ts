import { describe, expect, test } from 'vitest'
import { citeKind } from './cite'

describe('citeKind (출처 칩의 짧은 종류 이름)', () => {
  test('정해진 종류는 그대로 쓴다', () => {
    expect(citeKind({ kind: '회의록', org: '고양특례시의회' })).toBe('회의록')
    expect(citeKind({ kind: '계약정보', org: '고양특례시' })).toBe('계약정보')
  })

  test('기타는 발행처로 짧은 이름을 붙인다', () => {
    expect(citeKind({ kind: '기타', org: '지방재정365 (행정안전부)' })).toBe(
      '재정365',
    )
    expect(citeKind({ kind: '기타', org: '법제처 국가법령정보센터' })).toBe(
      '법령',
    )
    expect(citeKind({ kind: '기타', org: '감사원' })).toBe('감사')
    expect(citeKind({ kind: '기타', org: '경기도 감사위원회' })).toBe('감사')
  })

  test('발행처로도 알 수 없으면 ‘자료’', () => {
    expect(citeKind({ kind: '기타', org: '고양특례시' })).toBe('자료')
  })
})
