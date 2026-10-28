// 리포트 문장 규칙(glasses 문서 작성 체계). 리포트를 Firestore에 쓰기 전에 검사한다.
import { AXIS_IDS } from '../axes'
import type { ReportDoc } from '../report-doc'

/** 리포트에 들어 있는 시민용 문장 (자유 본문 조각 제외) */
export function sentences(a: ReportDoc): Array<string> {
  return [
    a.lede[0],
    a.verdict,
    ...AXIS_IDS.flatMap((id) => {
      const x = a.axes[id]
      return [
        x.line,
        x.title,
        ...(x.facts ?? []).map((f) => f.cited[0]),
        ...(x.said ?? []).map((s) => s[0]),
        x.per ?? '',
        x.missing ?? '',
      ]
    }),
    ...a.unknowns.map((u) => u.text),
  ].filter(Boolean)
}

const BANNED: ReadonlyArray<[RegExp, string]> = [
  [/에 대한/, '‘에 대한’ 대신 조사로 쓴다'],
  [/["']/, '곧은 따옴표 대신 “ ” ‘ ’를 쓴다'],
  [/\d\.\d억/, '‘1.5억’ 대신 ‘1억 5천만’처럼 쓴다'],
  [/의혹|특혜|부실|혈세/, '판단이 섞인 말(의혹·특혜·부실·혈세)을 쓰지 않는다'],
]

/** 규칙 위반 목록. 없으면 빈 배열 */
export function lintReportDoc(a: ReportDoc): Array<string> {
  const problems: Array<string> = []
  if (a.verdict.split(/(?<=다\.)\s+/).length > 4)
    problems.push('종합 판정은 4문장 안쪽')
  for (const id of AXIS_IDS) {
    // 합니다체(…니다.)도 ‘다.’로 끝나므로 따로 거른다
    if (!/(?<!니)다\.$/.test(a.axes[id].line))
      problems.push(`${id} 한 줄 요약은 한다체(…다.)로 끝난다`)
    for (const [text] of a.axes[id].said ?? [])
      if (!/^[^:(]+\(\d{4}\. \d{1,2}\.\): /.test(text))
        problems.push(`${id} 기관의 설명은 “직함(2024. 12.): …” 형식: ${text}`)
  }
  for (const s of sentences(a))
    for (const [re, why] of BANNED)
      if (re.test(s)) problems.push(`${why}: ${s}`)
  return problems
}
