import type { ReportInput } from '#/features/reports/schema'

type SourceInput = ReportInput['sources'][number]

// 여러 리포트가 함께 쓰는 원문. id와 쪽수(locator)는 리포트마다 붙인다.
const BUDGET_BOARD =
  'https://www.goyang.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1045'
const KOGL_3 = '공공누리 제3유형 (출처표시·변경금지)'
export const KOGL_4 = '공공누리 제4유형 (출처표시·상업적 이용금지·변경금지)'
export const COUNCIL_LICENSE = '이용조건 표기 없음'

export function budgetFinal(id: string, locator: string): SourceInput {
  return {
    id,
    title: '2026년도 제3회 추가경정예산서 (의결일 2026. 9. 3.)',
    org: '고양특례시 예산담당관',
    kind: '예산서',
    date: '2026-09-15',
    url: `${BUDGET_BOARD}&q_bbscttSn=20260915212334629`,
    license: KOGL_3,
    locator,
  }
}

export function budgetDraft(
  id: string,
  file: '예산(안)' | '수정예산(안)',
  locator: string,
): SourceInput {
  return {
    id,
    title: `2026년도 제3회 추가경정 ${file}`,
    org: '고양특례시 예산담당관',
    kind: '예산서',
    date: '2026-08-13',
    url: `${BUDGET_BOARD}&q_bbscttSn=20260813214927539`,
    license: KOGL_3,
    locator,
  }
}

export function cityPress(
  id: string,
  date: string,
  title: string,
  sn: string,
): SourceInput {
  return {
    id,
    title,
    org: '고양특례시',
    kind: '보도자료',
    date,
    url: `https://www.goyang.go.kr/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=${sn}&q_estnColumn1=All`,
    license: KOGL_4,
  }
}

export function councilPress(
  id: string,
  date: string,
  title: string,
  uid: string,
): SourceInput {
  return {
    id,
    title,
    org: '고양특례시의회',
    kind: '보도자료',
    date,
    url: `https://www.goyangcouncil.go.kr/kr/pressBBSview.do?uid=${uid}`,
    license: COUNCIL_LICENSE,
  }
}

/** 의회 회의록 본문 (HTML 뷰어). locator에 발언 위치를 적는다. */
export function councilMinutes(
  id: string,
  date: string,
  title: string,
  uid: string,
  locator: string,
): SourceInput {
  return {
    id,
    title,
    org: '고양특례시의회',
    kind: '회의록',
    date,
    url: `https://www.goyangcouncil.go.kr/viewer/minutes.do?uid=${uid}`,
    license: COUNCIL_LICENSE,
    locator,
  }
}

/** 회의록 부록(심사보고서·검토보고서 PDF) */
export function councilAppendix(
  id: string,
  date: string,
  title: string,
  uid: string,
  locator: string,
): SourceInput {
  return {
    id,
    title,
    org: '고양특례시의회',
    kind: '회의록',
    date,
    url: `https://www.goyangcouncil.go.kr/viewer/pdf.do?group=appendix&uid=${uid}`,
    license: COUNCIL_LICENSE,
    locator,
  }
}

/** 국가법령정보센터 조문. lsiSeq는 법령 판(시행일)마다 다르다. */
export function lawText(
  id: string,
  title: string,
  lsiSeq: string,
  locator: string,
): SourceInput {
  return {
    id,
    title,
    org: '법제처 국가법령정보센터',
    kind: '기타',
    date: '2026-10-27',
    url: `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${lsiSeq}`,
    license: '공공저작물 (법령)',
    locator,
  }
}

/** 지방재정365 세부사업별 세출현황 */
export function lofinExecution(
  id: string,
  title: string,
  asOf: string,
): SourceInput {
  return {
    id,
    title,
    org: '지방재정365 (행정안전부)',
    kind: '기타',
    date: asOf,
    url: 'https://www.lofin365.go.kr',
    license: '공공데이터',
    locator: `지자체 세출 > 세부사업별 집행현황, ${asOf} 기준`,
  }
}
