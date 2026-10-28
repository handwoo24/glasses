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
