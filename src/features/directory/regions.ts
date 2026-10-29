// 홈·지역·부처·용역 화면이 함께 쓰는 시도 타일 지도와 집계.
// 지도는 실제 경계 대신 17개 시도를 4열 × 6행 칸에 놓은 타일이다(캔버스 시안 홈 v3·v4).
import { SIDO } from './list'
import type { Distribution, ListedReport } from './list'
import type { DirOrg } from './server/directory.server'

export type SidoCode = keyof typeof SIDO

/** 타일의 짧은 이름과 칸 (1부터) */
export const SIDO_TILES: Readonly<
  Record<string, { short: string; col: number; row: number }>
> = {
  '41': { short: '경기', col: 2, row: 1 },
  '51': { short: '강원', col: 3, row: 1 },
  '28': { short: '인천', col: 1, row: 2 },
  '11': { short: '서울', col: 2, row: 2 },
  '43': { short: '충북', col: 3, row: 2 },
  '47': { short: '경북', col: 4, row: 2 },
  '44': { short: '충남', col: 1, row: 3 },
  '36': { short: '세종', col: 2, row: 3 },
  '30': { short: '대전', col: 3, row: 3 },
  '27': { short: '대구', col: 4, row: 3 },
  '52': { short: '전북', col: 1, row: 4 },
  '48': { short: '경남', col: 3, row: 4 },
  '31': { short: '울산', col: 4, row: 4 },
  '29': { short: '광주', col: 1, row: 5 },
  '46': { short: '전남', col: 2, row: 5 },
  '26': { short: '부산', col: 3, row: 5 },
  '50': { short: '제주', col: 1, row: 6 },
}

export interface SidoStat {
  /** 레지스트리에 올린 기관 수 */
  orgs: number
  /** 평가 대상 사업 카드 수 */
  cards: number
  /** 게시한 리포트 수 */
  published: number
  verdicts: Distribution
}

const emptyStat = (): SidoStat => ({
  orgs: 0,
  cards: 0,
  published: 0,
  verdicts: { fix: 0, watch: 0, 'on-track': 0, unknown: 0 },
})

/** 시도 코드 두 자리마다 기관·카드·평가 수와 판정 분포. 지역이 없는 기관(부처)은 세지 않는다 */
export function sidoStats(
  orgs: ReadonlyArray<DirOrg>,
  reports: ReadonlyArray<ListedReport>,
): Record<string, SidoStat> {
  const out: Record<string, SidoStat> = Object.fromEntries(
    Object.keys(SIDO_TILES).map((code) => [code, emptyStat()]),
  )
  for (const o of orgs) {
    const s = o.region ? out[o.region.slice(0, 2)] : undefined
    if (!s) continue
    s.orgs++
    s.cards += o.cards
  }
  for (const r of reports) {
    const s = r.region ? out[r.region.slice(0, 2)] : undefined
    if (!s) continue
    s.published++
    s.verdicts[r.overall]++
  }
  return out
}

/** 타일 색: 목록 전 · 목록만 · 개선 필요가 절반 넘음 · 그 밖의 평가 */
export type Tone = 'empty' | 'list' | 'hot' | 'warm'

export function toneOf(s: SidoStat): Tone {
  if (s.orgs === 0) return 'empty'
  if (s.published === 0) return 'list'
  return s.verdicts.fix * 2 > s.published ? 'hot' : 'warm'
}

/** 고른 시도. 없거나 모르는 코드면 평가가 가장 많은 시도, 평가가 없으면 카드가 가장 많은 시도 */
export function pickSido(
  stats: Readonly<Record<string, SidoStat>>,
  chosen: string | undefined,
): string {
  if (chosen && chosen in stats) return chosen
  const [best] = Object.entries(stats).sort(
    ([, a], [, b]) => b.published - a.published || b.cards - a.cards,
  )
  return best[0]
}

export type MinistryGroup = 'bu' | 'cheong' | 'cheo' | 'other'

export const MINISTRY_GROUPS: ReadonlyArray<{
  id: MinistryGroup
  name: string
}> = [
  { id: 'bu', name: '부' },
  { id: 'cheong', name: '청' },
  { id: 'cheo', name: '처 · 위원회' },
  { id: 'other', name: '헌법·독립기관 · 그 밖' },
]

/** 레지스트리에 상급 기관이 아직 없어서, 기관 종류와 이름 끝으로 묶는다 */
export function ministryGroup(o: Pick<DirOrg, 'name' | 'type'>): MinistryGroup {
  if (o.type !== '중앙행정기관') return 'other'
  if (o.name.endsWith('부')) return 'bu'
  if (o.name.endsWith('청')) return 'cheong'
  if (o.name.endsWith('처') || o.name.endsWith('위원회')) return 'cheo'
  return 'other'
}

/** 주소 앞머리 → 시도 코드. 정식 이름·줄인 이름·옛 이름(강원도, 전라북도) */
const ADDRESS_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ...Object.entries(SIDO).map(([code, name]) => [name, code] as const),
  ['강원도', '51'],
  ['전라북도', '52'],
  ['충청북도', '43'],
  ['충청남도', '44'],
  ['전라남도', '46'],
  ['경상북도', '47'],
  ['경상남도', '48'],
  ...Object.entries(SIDO_TILES).map(([code, t]) => [t.short, code] as const),
]

export function sidoOfAddress(address: string | undefined): string | undefined {
  const text = address?.trim()
  if (!text) return undefined
  return ADDRESS_PREFIXES.find(([prefix]) => text.startsWith(prefix))?.[1]
}
