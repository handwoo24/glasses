// 리포트 문장 규칙(glasses 문서 작성 체계). 리포트를 Firestore에 쓰기 전에 검사한다.
import { AXIS_IDS } from '../axes'
import type { AxisDoc, ReportDoc } from '../report-doc'

/** 축 문서들의 시민용 문장 */
export function axisSentences<TAxis extends string>(
  axes: Record<TAxis, AxisDoc>,
  ids: ReadonlyArray<TAxis>,
): Array<string> {
  return ids.flatMap((id) => {
    const x = axes[id]
    return [
      x.line,
      x.title,
      ...(x.facts ?? []).map((f) => f.cited[0]),
      ...(x.said ?? []).map((s) => s[0]),
      x.per ?? '',
      x.missing ?? '',
    ]
  })
}

/** 리포트에 들어 있는 시민용 문장 (자유 본문 조각 제외) */
export function sentences(a: ReportDoc): Array<string> {
  return [
    a.lede[0],
    a.verdict,
    ...axisSentences(a.axes, AXIS_IDS),
    ...a.unknowns.map((u) => u.text),
  ].filter(Boolean)
}

const BANNED: ReadonlyArray<[RegExp, string]> = [
  [/에 대한/, '‘에 대한’ 대신 조사로 쓴다'],
  [/["']/, '곧은 따옴표 대신 “ ” ‘ ’를 쓴다'],
  [/\d\.\d억/, '‘1.5억’ 대신 ‘1억 5천만’처럼 쓴다'],
  [/의혹|특혜|부실|혈세/, '판단이 섞인 말(의혹·특혜·부실·혈세)을 쓰지 않는다'],
]

/** 축 문서의 형식 규칙: 한 줄 요약은 한다체, 기관의 설명은 “직함(시기): …” */
export function lintAxes<TAxis extends string>(
  axes: Record<TAxis, AxisDoc>,
  ids: ReadonlyArray<TAxis>,
): Array<string> {
  const problems: Array<string> = []
  for (const id of ids) {
    // 합니다체(…니다.)도 ‘다.’로 끝나므로 따로 거른다
    if (!/(?<!니)다\.$/.test(axes[id].line))
      problems.push(`${id} 한 줄 요약은 한다체(…다.)로 끝난다`)
    for (const [text] of axes[id].said ?? [])
      if (!/^[^:(]+\(\d{4}\. \d{1,2}\.\): /.test(text))
        problems.push(`${id} 기관의 설명은 “직함(2024. 12.): …” 형식: ${text}`)
  }
  return problems
}

/** 문장마다 쓰지 않는 표현 */
export function lintSentences(list: ReadonlyArray<string>): Array<string> {
  return list.flatMap((s) =>
    BANNED.filter(([re]) => re.test(s)).map(([, why]) => `${why}: ${s}`),
  )
}

/** 규칙 위반 목록. 없으면 빈 배열 */
export function lintReportDoc(a: ReportDoc): Array<string> {
  return [
    ...(a.verdict
      ? [
          '종합 판정 구역에는 판정 문단을 쓰지 않는다(### 다음 판단 시점 목록만)',
        ]
      : []),
    ...lintAxes(a.axes, AXIS_IDS),
    ...lintSentences(sentences(a)),
  ]
}
