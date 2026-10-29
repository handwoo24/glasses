// 업체 리포트 문장 규칙. 사업 리포트의 규칙에 더해 업체 이름 밖의 사람 이름을 쓰지 않는다.
import { axisSentences, lintAxes, lintSentences } from '../../reports/doc/lint'
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
  return [
    ...lintAxes(a.axes, VENDOR_AXIS_IDS),
    ...lintSentences(vendorSentences(a)),
  ]
}
