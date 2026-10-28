import { describe, expect, test } from 'vitest'
import { ReportSchema } from './schema'
import type { ReportInput } from './schema'

const check = (
  result: 'pass' | 'warn' | 'fail' | 'unknown',
  cite: Array<string> = ['s1'],
) => ({
  area: 'budget' as const,
  question: `질문 ${result}`,
  result,
  finding: '확인한 내용',
  criterion: '비교 기준',
  cite,
})

const base: ReportInput = {
  slug: 'sample',
  title: '예시',
  summary: '요약',
  verdict: '판정',
  entity: 'city',
  category: '교통',
  departments: ['스마트시티과'],
  status: '진행 중',
  publishedAt: '2026-10-27',
  updatedAt: '2026-10-27',
  brief: {
    what: '자율주행버스 운행',
    why: '대중교통 실증',
    cost: '1억 6천만 원',
    who: '운영 업체',
    now: '정식 운행 중',
    cite: ['s1'],
  },
  timeline: [
    { date: '2026-06-15', label: '시범운행', cite: ['s1'] },
    { date: '2026-10-20', label: '정식운행', cite: ['s1'] },
  ],
  points: [
    { claim: '결론 하나', evidence: [{ text: '근거', cite: ['s1'] }] },
    { claim: '결론 둘', evidence: [{ text: '근거', cite: ['s1'] }] },
  ],
  outcome: { summary: '이용객 수는 아직 공개되지 않았다' },
  unknowns: [{ what: '월간 실적', status: 'not-yet', when: '11월' }],
  actions: [{ title: '정보공개청구', detail: '실적 보고서를 청구한다' }],
  checks: [check('pass'), check('warn'), check('unknown', [])],
  scope: {
    covers: '2026년 운영 용역',
    asOf: [{ what: '계약', date: '2026-10-27' }],
  },
  skippedAreas: [
    { area: 'execution', reason: '집행 전' },
    { area: 'contract', reason: '계약 없음' },
    { area: 'process', reason: '해당 없음' },
    { area: 'outcome', reason: '운행 전' },
    { area: 'oversight', reason: '감사 시기 전' },
    { area: 'disclosure', reason: '점검 범위 밖' },
  ],
  response: { status: 'not-asked', note: '아직 묻지 않았다' },
  recommendations: [{ to: '고양시', what: '실적 공개' }],
  nextReview: { date: '2026-12', items: ['결산 확인'] },
  openQuestions: [],
  sources: [
    {
      id: 's1',
      title: '보도자료',
      org: '고양특례시',
      kind: '보도자료',
      date: '2026-10-20',
      url: 'https://www.goyang.go.kr/news/x',
      license: '공공누리 제4유형',
    },
  ],
  authorship: { method: 'AI 분석 초안', rubricVersion: '0.4' },
}

const issues = (input: unknown) => {
  const r = ReportSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('ReportSchema', () => {
  test('올바른 리포트는 통과한다', () => {
    expect(issues(base)).toEqual([])
  })

  test('없는 출처를 인용하면 거부한다', () => {
    const bad = {
      ...base,
      points: [
        ...base.points,
        { claim: 'x', evidence: [{ text: 'y', cite: ['s9'] }] },
      ],
    }
    expect(issues(bad)).toContain('없는 출처 s9')
  })

  test('인용되지 않은 출처가 있으면 거부한다', () => {
    const extra = { ...base.sources[0], id: 's2' }
    expect(issues({ ...base, sources: [...base.sources, extra] })).toContain(
      '인용되지 않은 출처 s2',
    )
  })

  test('확인 불가가 아닌 점검은 근거가 필요하다', () => {
    const bad = {
      ...base,
      checks: [check('pass'), check('warn'), check('fail', [])],
    }
    expect(issues(bad)).toContain('확인 불가가 아닌 점검은 근거가 필요')
  })

  test('점검은 3개 이상이어야 한다', () => {
    expect(
      ReportSchema.safeParse({ ...base, checks: [check('pass')] }).success,
    ).toBe(false)
  })

  test('허용되지 않은 도메인이나 http 출처는 거부한다', () => {
    const evil = { ...base.sources[0], url: 'https://example.com/x' }
    const http = { ...base.sources[0], url: 'http://www.goyang.go.kr/x' }
    expect(ReportSchema.safeParse({ ...base, sources: [evil] }).success).toBe(
      false,
    )
    expect(ReportSchema.safeParse({ ...base, sources: [http] }).success).toBe(
      false,
    )
  })

  test('돈의 흐름은 시작액과 증감의 합이 최종액과 맞아야 한다', () => {
    const flow = {
      title: '운영비',
      start: { label: '기정', amount: 80_000, cite: ['s1'] },
      steps: [{ label: '증액', delta: 80_000, cite: ['s1'] }],
      end: { label: '의결', amount: 160_001, cite: ['s1'] },
    }
    expect(issues({ ...base, moneyFlow: flow })).toContain(
      'start + 단계별 증감의 합이 end와 같아야 함',
    )
  })

  test('묶음 차트의 모든 행은 모든 계열 값을 가져야 한다', () => {
    const chart = {
      type: 'grouped',
      id: 'source-mix',
      section: 'budget',
      title: '재원',
      unit: 'krw-thousand',
      series: [
        { key: 'a', label: '국비' },
        { key: 'b', label: '시비' },
      ],
      data: [{ label: '전기차', values: { a: 1 } }],
      cite: ['s1'],
    }
    expect(issues({ ...base, charts: [chart] })).toContain(
      '차트 행에 계열 값이 빠짐',
    )
  })

  test('timeline은 날짜 오름차순이어야 한다', () => {
    const bad = { ...base, timeline: [...base.timeline].reverse() }
    expect(issues(bad)).toContain('timeline은 날짜 오름차순')
  })

  test('7개 영역은 점검하거나 빠진 사유를 적어야 한다', () => {
    const bad = { ...base, skippedAreas: base.skippedAreas?.slice(1) }
    expect(issues(bad)).toContain('점검하지 않은 영역은 사유가 필요: execution')
  })

  test('점검한 영역을 빠진 영역으로 함께 적으면 거부한다', () => {
    const bad = {
      ...base,
      skippedAreas: [
        ...(base.skippedAreas ?? []),
        { area: 'budget' as const, reason: 'x' },
      ],
    }
    expect(issues(bad)).toContain('점검한 영역을 빠진 영역으로 적음: budget')
  })

  test('점검마다 판단 기준이 필요하다', () => {
    const noCriterion = { ...check('pass'), criterion: undefined }
    const bad = { ...base, checks: [noCriterion, check('warn'), check('pass')] }
    expect(ReportSchema.safeParse(bad).success).toBe(false)
  })

  test('시 해명과 공개 현황의 인용도 출처가 있어야 한다', () => {
    const bad = {
      ...base,
      response: {
        status: 'not-asked' as const,
        note: 'x',
        items: [{ topic: '운행', said: '답변', cite: ['s7'] }],
      },
    }
    expect(issues(bad)).toContain('없는 출처 s7')
  })

  test('금액은 점검 대상 금액이 있을 때만, 그보다 크지 않게 적는다', () => {
    const withAmount = { ...check('warn'), amount: 100 }
    expect(
      issues({ ...base, checks: [withAmount, check('pass'), check('pass')] }),
    ).toContain('금액을 적으려면 scope.total이 필요')
    const scoped = { ...base.scope, total: 50 }
    expect(
      issues({
        ...base,
        scope: scoped,
        checks: [withAmount, check('pass'), check('pass')],
      }),
    ).toContain('지적 금액이 점검 대상 금액보다 큼')
  })

  test('같은 원인 묶음은 두 건 이상이어야 한다', () => {
    const lone = { ...check('warn'), group: 'g' }
    expect(
      issues({ ...base, checks: [lone, check('pass'), check('pass')] }),
    ).toContain('묶음 g에 점검이 하나뿐')
  })

  test('사용자 정보가 붙은 출처 주소는 거부한다', () => {
    const bad = { ...base.sources[0], url: 'https://u:p@www.goyang.go.kr/x' }
    expect(ReportSchema.safeParse({ ...base, sources: [bad] }).success).toBe(
      false,
    )
  })

  test('알아야 할 것에 붙인 차트는 있어야 하고 한 번만 붙인다', () => {
    const chart = {
      type: 'bar' as const,
      id: 'cost',
      section: 'budget' as const,
      title: '운영비는 늘었다',
      unit: 'krw' as const,
      data: [
        { label: '2025', value: 1 },
        { label: '2026', value: 2 },
      ],
      cite: ['s1'],
    }
    const point = (charts: Array<string>) => ({
      claim: 'c',
      evidence: [{ text: 'e', cite: ['s1'] }],
      charts,
    })
    expect(issues({ ...base, points: [point(['nope']), point([])] })).toContain(
      '없는 차트 nope',
    )
    expect(
      issues({
        ...base,
        charts: [chart],
        points: [point(['cost']), point(['cost'])],
      }),
    ).toContain('차트 cost를 두 번 붙임')
    expect(
      issues({
        ...base,
        charts: [chart],
        points: [point(['cost']), point([])],
      }),
    ).toEqual([])
  })

  test('시민 행동 링크는 허용된 https 주소만 받는다', () => {
    const action = (url: string) => ({
      ...base,
      actions: [{ title: '청구', detail: 'd', url }],
    })
    expect(issues(action('https://www.open.go.kr/'))).toEqual([])
    expect(issues(action('https://evil.example/'))).not.toEqual([])
    expect(issues(action('http://www.open.go.kr/'))).not.toEqual([])
    expect(issues(action('https://www.open.go.kr:444/'))).not.toEqual([])
    expect(() => ReportSchema.safeParse(action('foo'))).not.toThrow()
    expect(issues(action('foo'))).not.toEqual([])
  })
})
