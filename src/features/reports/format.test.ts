import { describe, expect, test } from 'vitest'
import {
  formatDate,
  formatKrwThousand,
  formatNumber,
  formatWon,
} from './format'

describe('formatKrwThousand', () => {
  test('조·억·만 단위로 나눠 표기한다', () => {
    expect(formatKrwThousand(3_762_971_365)).toBe('3조 7,629억 7,137만 원')
  })

  test('억 단위로 반올림해 간단히 표기한다', () => {
    expect(formatKrwThousand(3_762_971_365, { precision: '억' })).toBe(
      '3조 7,630억 원',
    )
  })

  test('0인 단위는 생략한다', () => {
    expect(formatKrwThousand(160_000)).toBe('1억 6,000만 원')
    expect(formatKrwThousand(80_000)).toBe('8,000만 원')
  })

  test('감소는 마이너스, 증가는 signed일 때 플러스를 붙인다', () => {
    expect(formatKrwThousand(-16_293_844)).toBe('−162억 9,384만 원')
    expect(formatKrwThousand(654_400, { signed: true })).toBe('+6억 5,440만 원')
  })

  test('반올림 결과가 0이면 0원', () => {
    expect(formatKrwThousand(4)).toBe('0원')
  })
})

describe('formatNumber', () => {
  test('부호와 천 단위 구분', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(-5, true)).toBe('−5')
    expect(formatNumber(5, true)).toBe('+5')
  })
})

describe('formatDate', () => {
  test('일까지 있는 날짜와 월까지만 있는 날짜', () => {
    expect(formatDate('2026-10-20')).toBe('2026. 10. 20.')
    expect(formatDate('2023-10')).toBe('2023. 10.')
  })
})

describe('formatWon', () => {
  test('원 단위 금액을 억·만으로 끊는다', () => {
    expect(formatWon(1_061_680_000)).toBe('10억 6,168만 원')
    expect(formatWon(95_000_000)).toBe('9,500만 원')
    expect(formatWon(400_000_000)).toBe('4억 원')
  })
})
