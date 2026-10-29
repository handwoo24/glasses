// 조달청 나라장터 OpenAPI(공공데이터포털) 호출. 인증키는 DATA_GO_KR_SERVICE_KEY에서 읽고 출력·저장하지 않는다.
// 응답의 대표자·담당 공무원 이름과 연락처는 자료로 남기기 전에 지운다.

const BASE = 'https://apis.data.go.kr/1230000'

/** 사람 이름·연락처가 들어 있는 필드 (대표자, 계약·공고 담당자, 낙찰업체 담당자). 대소문자를 가리지 않는다 */
const PERSON_FIELD =
  /(ceoNm|ofcl|exctvNm|chrgr?Nm|mngrNm|telNo|faxNo|email|rprsntvNm)/i

/** ^로 이은 업체 문자열에서 대표자 칸의 위치 (0부터) */
const CARET_PERSON: Readonly<Record<string, number>> = {
  /** [순번^구분^공동^업체명^대표자명^국가^지분^업체명^^사업자번호], … */
  corpList: 4,
  /** 업체명^사업자번호^대표자명^투찰금액^투찰률 */
  opengCorpInfo: 2,
}

function blankAt(value: string, index: number): string {
  return value
    .split('],[')
    .map((seg) =>
      seg
        .split('^')
        .map((part, i) => (i === index ? '' : part))
        .join('^'),
    )
    .join('],[')
}

export function stripPeople(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPeople)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !PERSON_FIELD.test(k))
        .map(([k, v]) => [
          k,
          k in CARET_PERSON && typeof v === 'string'
            ? blankAt(v, CARET_PERSON[k])
            : stripPeople(v),
        ]),
    )
  return value
}

/** 포털이 주는 ‘인코딩’ 키(%가 들어 있음)는 그대로, ‘디코딩’ 키는 인코딩해서 붙인다 */
export function g2bUrl(
  service: string,
  operation: string,
  key: string,
  params: Readonly<Record<string, string>>,
): string {
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const query = new URLSearchParams({
    pageNo: '1',
    numOfRows: '100',
    type: 'json',
    ...params,
  })
  return `${BASE}/${service}/${operation}?serviceKey=${serviceKey}&${query.toString()}`
}

interface Envelope {
  header?: { resultCode?: string; resultMsg?: string }
  body?: { items?: unknown; totalCount?: number }
}

/** 응답 → 목록과 전체 건수. 오류 응답이면 코드·메시지로 실패한다 */
export function g2bItems(json: unknown): {
  items: Array<Record<string, unknown>>
  total: number
} {
  const root = json as Record<string, Envelope | undefined>
  const error = Object.entries(root).find(([k]) => k.endsWith('ResponseError'))
  if (error) {
    const h = error[1]?.header
    throw new Error(
      `나라장터 오류 ${h?.resultCode ?? ''} ${h?.resultMsg ?? ''}`.trim(),
    )
  }
  const r = root.response
  if (r?.header?.resultCode && r.header.resultCode !== '00')
    throw new Error(
      `나라장터 오류 ${r.header.resultCode} ${r.header.resultMsg ?? ''}`.trim(),
    )
  const raw = r?.body?.items
  const inner =
    raw && !Array.isArray(raw) && typeof raw === 'object' && 'item' in raw
      ? raw.item
      : raw
  const items = (
    inner === undefined || inner === '' ? [] : [inner].flat()
  ) as Array<Record<string, unknown>>
  return { items, total: Number(r?.body?.totalCount ?? items.length) }
}

/** 한 번 호출해 사람 정보를 지운 응답을 돌려준다 */
export async function g2bFetch(
  service: string,
  operation: string,
  params: Readonly<Record<string, string>>,
  key = process.env.DATA_GO_KR_SERVICE_KEY,
): Promise<unknown> {
  if (!key)
    throw new Error(
      'DATA_GO_KR_SERVICE_KEY가 없다 (loop.env.local에 공공데이터포털 인증키)',
    )
  const res = await fetch(g2bUrl(service, operation, key, params), {
    headers: { 'User-Agent': 'glasses' },
    signal: AbortSignal.timeout(90_000),
  })
  // 오류 메시지에 인증키가 섞여 나가지 않게 한다
  if (!res.ok) throw new Error(`나라장터 HTTP ${res.status} (${operation})`)
  const text = (await res.text()).replaceAll(key, '***')
  return stripPeople(JSON.parse(text))
}
