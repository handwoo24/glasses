import { describe, expect, test } from 'vitest'
import { countResults, countedChecks, exclusionOf, gradeOf } from './rubric'
import type { CheckResult } from './schema'

const checks = (...rs: Array<CheckResult>) => rs.map((result) => ({ result }))

describe('gradeOf (공개 등급 규칙)', () => {
  test('문제가 하나라도 있으면 미흡', () => {
    expect(gradeOf(checks('pass', 'pass', 'fail'))).toBe('poor')
  })

  test('문제는 없고 주의가 있으면 주의', () => {
    expect(gradeOf(checks('pass', 'warn', 'unknown'))).toBe('caution')
  })

  test('확인된 항목이 확인 불가보다 적으면 판단 보류', () => {
    expect(gradeOf(checks('pass', 'unknown', 'unknown'))).toBe('insufficient')
    expect(gradeOf(checks('unknown'))).toBe('insufficient')
  })

  test('문제·주의가 없고 확인된 항목이 더 많으면 양호', () => {
    expect(gradeOf(checks('pass', 'pass', 'unknown'))).toBe('good')
    expect(gradeOf(checks('pass', 'unknown'))).toBe('good')
  })

  test('결과별 개수를 센다', () => {
    expect(countResults(checks('pass', 'warn', 'warn', 'unknown'))).toEqual({
      pass: 1,
      warn: 2,
      fail: 0,
      unknown: 1,
    })
  })
})

describe('같은 원인 묶음과 경미한 지적', () => {
  test('같은 원인으로 묶인 점검은 가장 무거운 하나만 센다', () => {
    const list = [
      { result: 'fail' as const, group: 'city-share' },
      { result: 'fail' as const, group: 'city-share' },
      { result: 'pass' as const },
    ]
    expect(countedChecks(list)).toHaveLength(2)
    expect(exclusionOf(list[1], list)).toBe('grouped')
    expect(exclusionOf(list[0], list)).toBeUndefined()
  })

  test('묶음 안에서는 결과가 더 무거운 점검이 남는다', () => {
    const list = [
      { result: 'warn' as const, group: 'g' },
      { result: 'fail' as const, group: 'g' },
    ]
    expect(exclusionOf(list[0], list)).toBe('grouped')
    expect(gradeOf(list)).toBe('poor')
  })

  test('점검 대상 금액의 1% 미만인 주의·문제는 등급에 넣지 않는다', () => {
    const list = [
      { result: 'warn' as const, amount: 14_200_000 },
      { result: 'pass' as const },
      { result: 'pass' as const },
    ]
    const total = 182_800_000_000
    expect(exclusionOf(list[0], list, { total })).toBe('minor')
    expect(gradeOf(list, { total })).toBe('good')
    expect(gradeOf(list)).toBe('caution')
  })

  test('금액이 1% 이상이거나 금액이 없는 지적은 그대로 센다', () => {
    const list = [
      { result: 'warn' as const, amount: 3_900_000_000 },
      { result: 'fail' as const },
    ]
    const total = 182_800_000_000
    expect(countedChecks(list, { total })).toHaveLength(2)
  })

  test('결과가 같으면 금액이 큰 점검이 묶음을 대표한다', () => {
    const total = 10_000_000_000
    const list = [
      { result: 'fail' as const, group: 'g', amount: 10_000_000 },
      { result: 'fail' as const, group: 'g', amount: 2_000_000_000 },
    ]
    expect(exclusionOf(list[1], list, { total })).toBeUndefined()
    expect(exclusionOf(list[0], list, { total })).toBe('grouped')
    expect(gradeOf(list, { total })).toBe('poor')
  })

  test('확인됨·확인 불가는 묶음에 들어 있어도 빠지지 않는다', () => {
    const list = [
      { result: 'fail' as const, group: 'g' },
      { result: 'pass' as const, group: 'g' },
    ]
    expect(exclusionOf(list[1], list)).toBeUndefined()
  })

  test('금액이 0인 지적은 경미로 보지 않는다', () => {
    const list = [{ result: 'fail' as const, amount: 0 }]
    expect(exclusionOf(list[0], list, { total: 1_000_000 })).toBeUndefined()
  })
})
