import { describe, expect, test } from 'vitest'
import { daysUntil, judgeDateStart } from './dates'

describe('judgeDateStart (판단 시점 라벨의 시작 날짜)', () => {
  test('연도 없는 날짜는 기준일의 해로 읽는다', () => {
    expect(judgeDateStart('11. 10.', '2026-10-27')).toBe('2026-11-10')
    expect(judgeDateStart('11. 12.~19.', '2026-10-27')).toBe('2026-11-12')
    expect(judgeDateStart('11. 10.~12. 10.', '2026-10-27')).toBe('2026-11-10')
  })

  test('기준일보다 앞선 달이면 다음 해로 읽는다', () => {
    expect(judgeDateStart('1. 15.', '2026-10-27')).toBe('2027-01-15')
    expect(judgeDateStart('2월', '2026-10-27')).toBe('2027-02')
  })

  test('달만 쓴 라벨은 그 달', () => {
    expect(judgeDateStart('12월', '2026-10-27')).toBe('2026-12')
    expect(judgeDateStart('10월', '2026-10-27')).toBe('2026-10')
  })

  test('연도를 쓴 라벨은 그대로', () => {
    expect(judgeDateStart('2026. 11. 10.', '2026-10-27')).toBe('2026-11-10')
    expect(judgeDateStart('2027년 3월', '2026-10-27')).toBe('2027-03')
    expect(judgeDateStart('2027년 상반기', '2026-10-27')).toBe('2027-01')
    expect(judgeDateStart('2027년 하반기', '2026-10-27')).toBe('2027-07')
  })

  test('읽을 수 없는 라벨은 날짜가 없다', () => {
    expect(judgeDateStart('추후 공지', '2026-10-27')).toBeUndefined()
    expect(judgeDateStart('13. 1.', '2026-10-27')).toBeUndefined()
  })
})

describe('daysUntil (D-day)', () => {
  test('날짜까지 남은 날', () => {
    expect(daysUntil('2026-11-10', '2026-10-28')).toBe(13)
    expect(daysUntil('2026-10-28', '2026-10-28')).toBe(0)
    expect(daysUntil('2026-10-27', '2026-10-28')).toBe(-1)
  })

  test('달만 있는 날짜는 세지 않는다', () => {
    expect(daysUntil('2026-12', '2026-10-28')).toBeUndefined()
  })
})
