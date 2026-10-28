import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { getReportDoc, reportDocs } from './report-docs'
import { AXIS_IDS } from '#/features/reports/axes'
import type { ReportDoc } from '#/features/reports/report-doc'
import { ReportPage } from '#/features/reports/view/report-page'

/** 리포트에 들어 있는 시민용 문장 (렌더링된 본문 조각 제외) */
function sentences(a: ReportDoc): Array<string> {
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

describe('게시 리포트', () => {
  test('slug가 겹치지 않고 slug로 찾을 수 있다', () => {
    expect(new Set(reportDocs.map((d) => d.slug)).size).toBe(reportDocs.length)
    expect(getReportDoc(reportDocs[0].slug)).toBe(reportDocs[0])
    expect(getReportDoc('nope')).toBeUndefined()
  })

  // 출처 번호(Cite)와 본문 조각은 그릴 때 검사되므로 한 번씩 그려 본다
  test.each(reportDocs)('$slug: 화면을 그릴 수 있다', (doc) => {
    expect(() =>
      renderToStaticMarkup(createElement(ReportPage, { doc })),
    ).not.toThrow()
  })
})

describe('문서 작성 체계', () => {
  test.each(reportDocs)('$slug: 종합 판정 문장은 4문장 안쪽', (a) => {
    expect(a.verdict.split(/(?<=다\.)\s+/).length).toBeLessThanOrEqual(4)
  })

  test.each(reportDocs)('$slug: 시의 설명에는 직함과 시기가 붙는다', (a) => {
    const said = AXIS_IDS.flatMap((id) => a.axes[id].said ?? [])
    for (const [text] of said) {
      expect(text).toMatch(/^[^:(]+\(\d{4}\. \d{1,2}\.\): /)
    }
  })

  test.each(reportDocs)('$slug: 축 한 줄은 한다체로 끝난다', (a) => {
    for (const id of AXIS_IDS) expect(a.axes[id].line).toMatch(/다\.$/)
  })

  test.each(reportDocs)('$slug: 쓰지 않는 표기가 없다', (a) => {
    for (const s of sentences(a)) {
      expect(s).not.toMatch(/에 대한|"|'/)
      expect(s).not.toMatch(/\d\.\d억/)
      expect(s).not.toMatch(/의혹|특혜|부실|혈세/)
    }
  })
})
