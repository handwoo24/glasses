import { describe, expect, test } from 'vitest'
import { chainFor, fixDecision, pickPrograms, sameHighs } from './plan'
import type { ReviewEntry } from './plan'

const review = (
  id: string,
  verdict: 'pass' | 'fail',
  highs: Array<[string, string]> = [],
  report = '2026-10-28',
): ReviewEntry => ({
  id,
  report,
  verdict,
  reviewedAt: `2026-10-28T1${id.at(-1)}:00:00Z`,
  findings: highs.map(([where, type]) => ({ where, type, severity: 'high' })),
})

describe('chainFor', () => {
  test('대기·수집은 수집부터 초안까지', () => {
    expect(chainFor('대기')).toEqual(['collect', 'extract', 'ledger', 'draft'])
    expect(chainFor('수집')).toEqual(['collect', 'extract', 'ledger', 'draft'])
  })

  test('분석은 사실 원장을 이어서 하고 초안', () => {
    expect(chainFor('분석')).toEqual(['ledger', 'draft'])
  })

  test('작성·검증·고침·게시 대기는 한 칸', () => {
    expect(chainFor('작성')).toEqual(['draft'])
    expect(chainFor('검증')).toEqual(['verify'])
    expect(chainFor('고침')).toEqual(['fix'])
    expect(chainFor('게시 대기')).toEqual(['publish'])
  })

  test('게시는 할 일이 없다', () => {
    expect(chainFor('게시')).toEqual([])
  })
})

describe('fixDecision', () => {
  test('첫 fail은 Sonnet으로 고친다', () => {
    const d = fixDecision(
      [review('2026-10-28-1', 'fail', [['② 진척', '수치 불일치']])],
      '2026-10-28',
    )
    expect(d).toEqual({ kind: 'fix', model: 'sonnet', review: '2026-10-28-1' })
  })

  test('두 번째 fail은 Opus로 고친다', () => {
    const d = fixDecision(
      [
        review('2026-10-28-1', 'fail', [['② 진척', '수치 불일치']]),
        review('2026-10-28-2', 'fail', [['④ 비용', '출처 불일치']]),
      ],
      '2026-10-28',
    )
    expect(d).toEqual({ kind: 'fix', model: 'opus', review: '2026-10-28-2' })
  })

  test('세 번째 fail이면 멈춘다', () => {
    const d = fixDecision(
      [
        review('2026-10-28-1', 'fail', [['a', '수치 불일치']]),
        review('2026-10-28-2', 'fail', [['b', '수치 불일치']]),
        review('2026-10-28-3', 'fail', [['c', '수치 불일치']]),
      ],
      '2026-10-28',
    )
    expect(d.kind).toBe('stop')
  })

  test('같은 high가 두 회차 연달아 남으면 회차가 남아도 멈춘다', () => {
    const d = fixDecision(
      [
        review('2026-10-28-1', 'fail', [['② 진척 > 사실 6', '수치 불일치']]),
        review('2026-10-28-2', 'fail', [['② 진척 > 사실 6', '수치 불일치']]),
      ],
      '2026-10-28',
    )
    expect(d.kind).toBe('stop')
  })

  test('다른 판의 검증 기록은 세지 않는다', () => {
    const d = fixDecision(
      [
        review('2026-10-01-1', 'fail', [['a', '수치 불일치']], '2026-10-01'),
        review('2026-10-01-2', 'fail', [['b', '수치 불일치']], '2026-10-01'),
        review('2026-10-28-1', 'fail', [['c', '수치 불일치']]),
      ],
      '2026-10-28',
    )
    expect(d).toEqual({ kind: 'fix', model: 'sonnet', review: '2026-10-28-1' })
  })

  test('이 판의 fail 기록이 없으면 멈춘다', () => {
    expect(fixDecision([], '2026-10-28').kind).toBe('stop')
  })
})

describe('sameHighs', () => {
  test('where와 type이 같은 high가 하나라도 있으면 참', () => {
    expect(
      sameHighs(
        review('x-1', 'fail', [
          ['a', '수치 불일치'],
          ['b', '표기'],
        ]),
        review('x-2', 'fail', [['b', '표기']]),
      ),
    ).toBe(true)
  })

  test('where가 같아도 type이 다르면 거짓', () => {
    expect(
      sameHighs(
        review('x-1', 'fail', [['a', '수치 불일치']]),
        review('x-2', 'fail', [['a', '표기']]),
      ),
    ).toBe(false)
  })
})

describe('pickPrograms', () => {
  const item = (
    path: string,
    stage: Parameters<typeof chainFor>[0],
    priority: 'high' | 'medium' | 'low' = 'medium',
    budget: number | null = null,
  ) => ({ path, stage, priority, budget })

  test('고침 → 검증 → 이어 하기 → 대기 순, 같은 단계면 우선순위·예산 순으로 개수만큼', () => {
    const picked = pickPrograms(
      [
        item('p/wait-low', '대기', 'low', 9e9),
        item('p/wait-high-small', '대기', 'high', 1e8),
        item('p/wait-high-big', '대기', 'high', 5e9),
        item('p/fix', '고침'),
        item('p/analysis', '분석'),
        item('p/verify', '검증'),
        item('p/done', '게시'),
      ],
      5,
    )
    expect(picked).toEqual([
      'p/fix',
      'p/verify',
      'p/analysis',
      'p/wait-high-big',
      'p/wait-high-small',
    ])
  })

  test('게시 대기는 개수와 상관없이 모두 더한다', () => {
    const picked = pickPrograms(
      [
        item('p/a', '대기', 'high'),
        item('p/b', '대기'),
        item('p/ready', '게시 대기'),
      ],
      1,
    )
    expect(picked).toEqual(['p/a', 'p/ready'])
  })

  test('경로를 정해 주면 그것만', () => {
    const picked = pickPrograms(
      [
        item('p/a', '대기', 'high'),
        item('p/b', '대기'),
        item('p/c', '게시 대기'),
      ],
      3,
      ['p/b'],
    )
    expect(picked).toEqual(['p/b'])
  })
})
