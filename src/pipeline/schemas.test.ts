import { describe, expect, test } from 'vitest'
import { isCollection, resolve } from './paths'
import { quoteMatches } from './check'
import { FactSchema, ReviewSchema, unmaskedNames } from './schemas'

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

describe('이름 가리기', () => {
  const minutes =
    '이게 눈높이에 맞아요? ○스마트시티과장 안동수 비쌉니다. ○ 최규진 위원 버스 한 대에 18억?'

  test.each([
    ['○스마트시티과장 안동수 비쌉니다.', ['안동수']],
    ['○ 최규진 위원 버스 한 대에', ['최규진']],
    ['○재난대응담당관 박성완 예.', ['박성완']],
    ['○스마트시티과장 ○○○ 비쌉니다.', []],
    ['○ ○○○ 위원 버스 한 대에', []],
    ['스마트시티과장이 답했다', []],
  ])('%s', (text, names) => {
    expect(unmaskedNames(text)).toEqual(names)
  })

  test('가리지 않은 이름이 인용에 있으면 쓰지 않는다', () => {
    const fact = (quote: string) =>
      FactSchema.safeParse({ ...sourced, kind: '발언', quote }).success
    expect(fact('○스마트시티과장 안동수 비쌉니다.')).toBe(false)
    expect(fact('○스마트시티과장 ○○○ 비쌉니다.')).toBe(true)
  })

  test('가린 인용도 원문에서 찾는다', () => {
    expect(quoteMatches(minutes, '○스마트시티과장 ○○○ 비쌉니다.')).toBe(true)
    expect(quoteMatches(minutes, '○ ○○○ 위원 버스 한 대에 18억?')).toBe(true)
    expect(quoteMatches(minutes, '○스마트시티과장 ○○○ 쌉니다.')).toBe(false)
    expect(quoteMatches(minutes, '(괄호) ○○○')).toBe(false)
  })

  test('원문의 줄바꿈은 공백으로 보고 맞춘다', () => {
    const text = '그냥 쉽게…….\n○스마트시티과장 안동수 비쌉니다.'
    expect(quoteMatches(text, '쉽게……. ○스마트시티과장 ○○○ 비쌉니다.')).toBe(
      true,
    )
    expect(quoteMatches(text, '쉽게…….○스마트시티과장 ○○○ 비쌉니다.')).toBe(
      false,
    )
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
  test.each([
    ['orgs/3940000', 'org', undefined],
    ['orgs/3940000/budgets/2026-supplementary-3', 'budget', 'orgs/3940000'],
    ['orgs/3940000/notes/finance-2026', 'note', 'orgs/3940000'],
    ['programs/3940000.autonomous-bus', 'program', undefined],
    [
      'programs/3940000.autonomous-bus/facts/f12',
      'fact',
      'programs/3940000.autonomous-bus',
    ],
    [
      'orgs/3940000/budgets/2026-supplementary-3/reports/2026-10-27',
      'report',
      'orgs/3940000/budgets/2026-supplementary-3',
    ],
    ['budgetLines/3940000202330652-2026', 'budgetLine', undefined],
    ['materials/m-7994c9640ce6', 'material', undefined],
    ['published/autonomous-bus-dallil-goyang', 'published', undefined],
  ])('%s → %s', (path, kind, parent) => {
    expect(resolve(path)).toMatchObject({ kind, parent })
  })

  test.each([
    'programs/goyang.autonomous-bus',
    'programs/3940000',
    'orgs/goyang',
    'orgs/3940000/budgets/2026-extra',
    'programs/3940000.bus/notes/N1',
    'programs/3940000.bus/files/f1',
    'materials/7994c9640ce6',
    'secrets/x',
  ])('정해지지 않은 경로는 실패한다: %s', (path) => {
    expect(() => resolve(path)).toThrow('정해지지 않은 경로')
  })

  test('정해진 컬렉션만 목록을 볼 수 있다', () => {
    expect(isCollection('programs')).toBe(true)
    expect(isCollection('programs/3940000.bus/facts')).toBe(true)
    expect(isCollection('orgs/3940000/budgets')).toBe(true)
    expect(isCollection('orgs/3940000/budgets/2026-original/facts')).toBe(true)
    expect(isCollection('programs/3940000.bus/files')).toBe(false)
  })
})
