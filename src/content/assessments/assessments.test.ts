import { describe, expect, test } from 'vitest'
import { reports } from '../reports'
import { assessments, getAssessment } from './index'
import { AXIS_IDS } from '#/features/reports/axes'
import {
  allSources,
  classifyChecks,
  signalsByAxis,
  staleCheckKeys,
} from '#/features/reports/assessment'
import type { Assessment } from '#/features/reports/assessment'

const pairs = assessments.map((a) => {
  const report = reports.find((r) => r.slug === a.reportSlug)
  if (!report) throw new Error(`리포트 없음: ${a.reportSlug}`)
  return [a, report] as const
})

/** 평가에 들어 있는 시민용 문장 (JSX 조각 제외) */
function sentences(a: Assessment): Array<string> {
  return [
    a.lede[0],
    a.verdict,
    ...AXIS_IDS.flatMap((id) => {
      const x = a.axes[id]
      return [
        x.line,
        x.title,
        ...(x.facts ?? []).map((f) => f[0]),
        ...(x.said ?? []).map((s) => s[0]),
        x.per ?? '',
        x.missing ?? '',
      ]
    }),
    ...a.unknowns.map((u) => u.text),
  ]
}

/** 데이터 필드에 쓴 출처 id */
function citedIds(a: Assessment): Array<string> {
  return [
    ...a.lede.slice(1),
    ...a.overview.cells.flatMap((c) => c.cite ?? []),
    ...(a.overview.chips?.cite ?? []),
    ...AXIS_IDS.flatMap((id) => [
      ...(a.axes[id].facts ?? []).flatMap((f) => f.slice(1)),
      ...(a.axes[id].said ?? []).flatMap((s) => s.slice(1)),
    ]),
    ...(a.newChecks ?? []).flatMap((k) => k.cite),
    ...a.unknowns.flatMap((u) => u.cite ?? []),
  ]
}

describe('게시 평가', () => {
  test('게시 리포트마다 평가가 하나씩 있다', () => {
    expect(assessments.map((a) => a.reportSlug).sort()).toEqual(
      reports.map((r) => r.slug).sort(),
    )
    expect(getAssessment('nope')).toBeUndefined()
  })

  test.each(pairs)('%s: 모든 점검과 지표에 축이 정해져 있다', (a, r) => {
    expect(() => classifyChecks(r, a)).not.toThrow()
    expect(() => signalsByAxis(r, a)).not.toThrow()
    expect(staleCheckKeys(r, a)).toEqual([])
  })

  test.each(pairs)('%s: 인용한 출처가 모두 출처 목록에 있다', (a, r) => {
    const known = new Set(allSources(r, a).map((s) => s.id))
    expect(citedIds(a).filter((id) => !known.has(id))).toEqual([])
  })
})

describe('문서 작성 체계', () => {
  test.each(assessments)('$reportSlug: 종합 판정 문장은 4문장 안쪽', (a) => {
    expect(a.verdict.split(/(?<=다\.)\s+/).length).toBeLessThanOrEqual(4)
  })

  test.each(assessments)(
    '$reportSlug: 시의 설명에는 직함과 시기가 붙는다',
    (a) => {
      const said = AXIS_IDS.flatMap((id) => a.axes[id].said ?? [])
      for (const [text] of said) {
        expect(text).toMatch(/^[^:(]+\(\d{4}\. \d{1,2}\.\): /)
      }
    },
  )

  test.each(assessments)('$reportSlug: 축 한 줄은 한다체로 끝난다', (a) => {
    for (const id of AXIS_IDS) expect(a.axes[id].line).toMatch(/다\.$/)
  })

  test.each(assessments)('$reportSlug: 쓰지 않는 표기가 없다', (a) => {
    for (const s of sentences(a)) {
      expect(s).not.toMatch(/에 대한|"|'/)
      expect(s).not.toMatch(/\d\.\d억/)
      expect(s).not.toMatch(/의혹|특혜|부실|혈세/)
    }
  })
})
