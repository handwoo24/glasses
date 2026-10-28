import { describe, expect, test } from 'vitest'
import { isCollection, resolve } from './paths'
import { FactSchema, ReviewSchema } from './schemas'

const sourced = {
  claim: '2026년 계약 금액은 10억 6,168만 원이다',
  kind: '수치',
  value: 1_061_675_200,
  unit: 'krw',
  material: 'm-7994c9640ce6',
  locator: '계약번호 202600213172',
  quote: '"ctrtAmt": 1061675200.0',
  recordedAt: '2026-10-28',
}

describe('사실 원장 양식', () => {
  test('원문 사실은 자료·위치·인용을 모두 갖는다', () => {
    expect(FactSchema.safeParse(sourced).success).toBe(true)
    const { quote: _quote, ...noQuote } = sourced
    expect(FactSchema.safeParse(noQuote).success).toBe(false)
  })

  test('계산된 사실은 근거 사실과 계산식을 갖는다', () => {
    const derived = {
      claim: '한 달 금액이 63% 늘었다',
      kind: '수치',
      value: 63.2,
      unit: 'percent',
      derivedFrom: ['f4', 'f5'],
      formula: '(f5/9) / (f4/12) - 1',
      recordedAt: '2026-10-28',
    }
    expect(FactSchema.safeParse(derived).success).toBe(true)
  })

  test('원문 사실과 계산된 사실을 섞으면 실패한다', () => {
    const mixed = { ...sourced, derivedFrom: ['f1'], formula: 'f1' }
    expect(FactSchema.safeParse(mixed).success).toBe(false)
  })
})

describe('검증 기록 양식', () => {
  const finding = {
    where: '종합 판정',
    type: '수치 불일치',
    claim: '…',
    evidence: '…',
  }
  test('중요도 높음 지적이 있으면 통과(pass)로 적을 수 없다', () => {
    const review = (verdict: string) => ({
      report: '2026-10-27',
      verdict,
      findings: [{ ...finding, severity: 'high' }],
      reviewedAt: '2026-10-28T10:00:00+09:00',
    })
    expect(ReviewSchema.safeParse(review('pass')).success).toBe(false)
    expect(ReviewSchema.safeParse(review('fail')).success).toBe(true)
  })
})

describe('경로', () => {
  test('정해진 경로는 양식과 사업 id를 찾는다', () => {
    expect(resolve('programs/goyang.autonomous-bus').kind).toBe('program')
    const fact = resolve('programs/goyang.autonomous-bus/facts/f12')
    expect(fact).toMatchObject({
      kind: 'fact',
      program: 'goyang.autonomous-bus',
    })
    expect(resolve('materials/m-7994c9640ce6').kind).toBe('material')
    expect(resolve('programs/goyang.bus/reports/2026-10-27').kind).toBe(
      'report',
    )
  })

  test.each([
    'programs/goyang',
    'programs/goyang.bus/facts/x1',
    'programs/goyang.bus/notes/n1',
    'materials/7994c9640ce6',
    'secrets/x',
  ])('정해지지 않은 경로는 실패한다: %s', (path) => {
    expect(() => resolve(path)).toThrow('정해지지 않은 경로')
  })

  test('정해진 컬렉션만 목록을 볼 수 있다', () => {
    expect(isCollection('programs')).toBe(true)
    expect(isCollection('programs/goyang.bus/facts')).toBe(true)
    expect(isCollection('programs/goyang.bus/notes')).toBe(false)
  })
})
