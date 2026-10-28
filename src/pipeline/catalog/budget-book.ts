// 예산서 세출 사업명세서 텍스트 → 세부사업마다 부서·정책사업·단위사업.
// 지방재정365 세출현황에는 부서와 사업 계층이 없어서 예산서에서 이름으로 찾아 붙인다.
// 텍스트는 scripts/catalog.ts pdf-text가 만든 것(쪽마다 "=== page N ===", 글자 사이 공백이 섞여 있다).

export interface BookLine {
  dept: string
  policy?: string
  unit?: string
  /** 공백을 지운 세부사업 이름 */
  name: string
}

/** 공백을 지운다. 예산서 PDF 텍스트는 글자마다 띄어 쓴 경우가 많다 */
export const despace = (s: string): string => s.replace(/\s+/g, '')

/** 재원 줄: 국 1,000 / 도 500 / 시 … / 기 … */
const isFund = (d: string) => /^(국|도|시|기|특|균)[\d,△]/.test(d)
/** 편성목 줄: 201일반운영비, 01사무관리비 */
const isCode = (d: string) => /^\d{2,3}[가-힣]/.test(d)
/** 산출 내역 줄: ○ 항목, 1,500,000원, 95,000원*50명 */
const isDetail = (d: string) =>
  /^[○。·\-ㆍ*※]/.test(d) ||
  /^[\d,.]+(천)?원/.test(d) ||
  /^\d[\d,]*(원)?[*×x]/.test(d) ||
  /\d원$/.test(d)
/** 정책사업 이름은 끝에 (분야/부문)이 붙는다 */
const isPolicy = (d: string) => /\([^()]+\/[^()]+\)$/.test(d)
/** 이름 + 금액 칸 최대 3개 */
const NAME_AMOUNTS =
  /^(.*?[^\d\s,△])\s*((?:△?\s*\d[\d\s,]*)(?:\s+△?\s*\d[\d\s,]*){0,2})$/

interface Header {
  dept?: string
  policy?: string
  unit?: string
}

/** 쪽 머리의 부서:·정책:·단위: */
function header(lines: ReadonlyArray<string>): Header {
  const h: Header = {}
  for (const l of lines.slice(0, 8)) {
    const d = despace(l)
    let m: RegExpMatchArray | null
    if ((m = d.match(/^부서:(.+)$/))) h.dept = m[1]
    else if ((m = d.match(/^정책:(.+)$/))) h.policy = m[1]
    else if ((m = d.match(/^단위:(.+?)(?:\(단위:천원\))?$/))) h.unit = m[1]
  }
  return h
}

/** 금액이 다음 줄로 넘어간 이름을 한 줄로 붙인다 */
function joinWrapped(body: ReadonlyArray<string>): Array<string> {
  const out: Array<string> = []
  for (let i = 0; i < body.length; i++) {
    const d = despace(body[i])
    const next = body.at(i + 1)
    if (isFund(d) || isCode(d) || isDetail(d) || /\d$/.test(d) || !next) {
      out.push(body[i])
      continue
    }
    const n = despace(next)
    if (/^[△\d,]+$/.test(n) || !(isFund(n) || isCode(n) || isDetail(n))) {
      out.push(`${body[i]} ${next}`)
      i++
    } else out.push(body[i])
  }
  return out
}

/**
 * 사업명세서 텍스트에서 세부사업 줄을 찾는다. 세부사업은 다음 의미 있는 줄이 편성목(201 …)인 이름 줄이다.
 * 단위사업과 세부사업 이름이 같을 수 있으므로 이미 아는 단위사업 이름이어도 다음 줄로 가린다.
 */
export function parseBudgetBook(text: string): Array<BookLine> {
  const pages = text
    .split(/=== page \d+ ===/)
    .map((p) =>
      p
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .map((lines) => ({ lines, h: header(lines) }))
    .filter((p) => p.h.dept)
  const known = {
    dept: new Set(pages.map((p) => p.h.dept)),
    policy: new Set(pages.flatMap((p) => p.h.policy ?? [])),
    unit: new Set(pages.flatMap((p) => p.h.unit ?? [])),
  }
  const out: Array<BookLine> = []
  let cur: Header = {}
  for (const { lines, h } of pages) {
    cur = {
      dept: h.dept,
      policy: h.policy ?? cur.policy,
      unit: h.unit ?? cur.unit,
    }
    const start = lines.findIndex((l) =>
      despace(l).startsWith('부서ㆍ정책ㆍ단위'),
    )
    const body = joinWrapped(
      lines
        .slice(start + 1)
        .filter((l) => !['예산액', '전년도'].includes(despace(l))),
    )
    for (let i = 0; i < body.length; i++) {
      const d = despace(body[i])
      if (isFund(d) || isCode(d) || isDetail(d)) continue
      const m = body[i].match(NAME_AMOUNTS)
      if (!m) continue
      const name = despace(m[1])
      if (known.dept.has(name)) {
        cur = { ...cur, dept: name }
        continue
      }
      if (known.policy.has(name) || isPolicy(name)) {
        cur = { ...cur, policy: name }
        continue
      }
      let j = i + 1
      while (j < body.length && isFund(despace(body[j]))) j++
      const next = j < body.length ? despace(body[j]) : ''
      if (isCode(next))
        out.push({
          dept: cur.dept ?? '',
          policy: cur.policy,
          unit: cur.unit,
          name,
        })
      else if (known.unit.has(name) || (next && !isDetail(next)))
        cur = { ...cur, unit: name }
    }
  }
  return out
}

/** 이름 비교용: 공백·가운뎃점 변형·따옴표를 맞춘다 */
export const nameKey = (s: string): string =>
  despace(s)
    .replace(/[·ㆍ・]/g, '·')
    .replace(/[“”‘’"']/g, '')
/** 느슨한 비교용: 괄호 안 설명과 기호까지 뺀다 */
export const looseKey = (s: string): string =>
  nameKey(s)
    .replace(/\([^()]*\)/g, '')
    .replace(/[-–_,.·]/g, '')

/** 세부사업 이름 → 예산서 줄들. 정확히 같은 이름, 괄호를 뺀 이름, 앞부분이 같은 이름 순으로 찾는다 */
export function findInBook(
  name: string,
  book: ReadonlyArray<BookLine>,
): { how: 'exact' | 'loose' | 'prefix'; lines: Array<BookLine> } | null {
  const exact = book.filter((b) => nameKey(b.name) === nameKey(name))
  if (exact.length) return { how: 'exact', lines: exact }
  const k = looseKey(name)
  const loose = book.filter((b) => looseKey(b.name) === k)
  if (loose.length) return { how: 'loose', lines: loose }
  if (k.length < 8) return null
  const prefix = book.filter((b) => {
    const bk = looseKey(b.name)
    return bk.length >= 8 && (bk.startsWith(k) || k.startsWith(bk))
  })
  return prefix.length ? { how: 'prefix', lines: prefix } : null
}

/** 사업이 아닌 세부사업: 행정경비와 재무 거래. 목록에서 빼고 개수만 센다 */
const ADMIN_NAME =
  /^(기본경비|부서기본경비|인력운영비.*|보전지출.*|내부거래\s?지출.*|예비비|예치금|예수금원리금상환|재정융자|.*반환금.*|기간제근로자 관리)$/
const ADMIN_POLICY = /^(행정운영경비|재무활동)/

export function isAdminLine(name: string, policy?: string): boolean {
  return ADMIN_NAME.test(name.trim()) || ADMIN_POLICY.test(policy ?? '')
}

/** 사업명 낱말로 나눈 임시 성격. 목록을 거르는 데만 쓰고 평가에 쓰지 않는다 */
export function kindOf(name: string): string {
  const n = name.replace(/도시관리공사|대행사업|공사·공단/g, '')
  if (
    /공사|건립|조성|설치|개설|확장|확충|리모델링|정비|건설|증축|신축|매입|보상|이전|구축/.test(
      n,
    )
  )
    return '건설·조성'
  if (/용역|계획|수립|연구|조사|타당성/.test(n)) return '용역·계획'
  if (/축제|행사|대회|박람회|페스티벌|공연|시상/.test(n)) return '행사'
  if (
    /수당|급여|연금|지급|보조금|지원금|바우처|장려금|감면|보험료|급식비|양육|무상|보육료|보급|이용권|환급/.test(
      n,
    )
  )
    return '현금·보조'
  if (/출연|출자|운영\s?지원|위탁/.test(n)) return '출연·위탁'
  if (/지원/.test(n)) return '지원'
  if (/운영|관리|유지/.test(n)) return '운영·관리'
  return '기타'
}
