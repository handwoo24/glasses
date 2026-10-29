// 업체 리포트 문장 규칙. 사업 리포트의 규칙에 더해, 회의록 화자 꼴(○과장 홍길동)로 드러난 이름을 막는다.
// 대표자·직원·다른 업체 이름을 모두 기계로 찾을 수는 없으므로 나머지는 검증 칸이 본다.
import { axisSentences, lintAxes, lintSentences } from '../../reports/doc/lint'
import { unmaskedNames } from '#/pipeline/schemas'
import { VENDOR_AXIS_IDS } from '../axes'
import type { VendorReportDoc } from '../vendor-doc'

/** 리포트에 들어 있는 시민용 문장 (자유 본문 조각 제외) */
export function vendorSentences(a: VendorReportDoc): Array<string> {
  return [
    a.lede[0],
    ...axisSentences(a.axes, VENDOR_AXIS_IDS),
    ...a.unknowns.map((u) => u.text),
  ].filter(Boolean)
}

/** 규칙 위반 목록. 없으면 빈 배열 */
export function lintVendorDoc(a: VendorReportDoc): Array<string> {
  const sentences = vendorSentences(a)
  return [
    ...lintAxes(a.axes, VENDOR_AXIS_IDS),
    ...lintSentences(sentences),
    ...sentences
      .filter((s) => unmaskedNames(s).length > 0)
      .map((s) => `사람 이름은 ○○○로 가린다: ${s}`),
  ]
}
