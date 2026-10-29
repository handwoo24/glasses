// 홈(지도에서 펼치기)·지역 탭·부처 탭이 읽는 것. 목록 스냅샷에서 서버가 집계해 화면에 필요한 만큼만 보낸다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import { byOrgOrder, heavyFirst, SIDO } from '../list'
import type { ListedReport } from '../list'
import { ministryGroup, pickSido, sidoStats } from '../regions'
import type { MinistryGroup, SidoStat } from '../regions'
import { readDirectory } from './directory.server'
import type { DirOrg } from './directory.server'

/** 홈 펼침 칸에 보이는 평가 수 */
const PANEL_REPORTS = 4

export interface SidoPanel {
  code: string
  name: string
  stat: SidoStat
  orgs: Array<DirOrg & { verdicts: SidoStat['verdicts'] }>
  /** 판정이 무거운 순 앞쪽 몇 건 (홈) */
  top: Array<ListedReport>
}

export interface MinistryTile extends DirOrg {
  group: MinistryGroup
}

export interface MinistryPanel {
  org: MinistryTile
  top: Array<ListedReport>
  total: number
}

export interface HomeData {
  stats: Record<string, SidoStat>
  panel: SidoPanel
  ministries: Array<MinistryTile>
  ministry: MinistryPanel | null
}

const inSido = (code: string) => (region: string | undefined) =>
  region?.slice(0, 2) === code

function verdictsOf(rows: ReadonlyArray<ListedReport>): SidoStat['verdicts'] {
  const out = { fix: 0, watch: 0, 'on-track': 0, unknown: 0 }
  for (const r of rows) out[r.overall]++
  return out
}

function sidoPanel(
  orgs: ReadonlyArray<DirOrg>,
  reports: ReadonlyArray<ListedReport>,
  stats: Record<string, SidoStat>,
  code: string,
  limit: number,
): SidoPanel {
  const here = inSido(code)
  const rows = reports.filter((r) => here(r.region))
  return {
    code,
    name: SIDO[code],
    stat: stats[code],
    orgs: orgs
      .filter((o) => here(o.region))
      .sort(byOrgOrder)
      .map((o) => ({
        ...o,
        verdicts: verdictsOf(rows.filter((r) => r.org === o.id)),
      })),
    top: heavyFirst(rows).slice(0, limit),
  }
}

function ministryTiles(orgs: ReadonlyArray<DirOrg>): Array<MinistryTile> {
  return orgs
    .filter((o) => CENTRAL_TYPES.has(o.type))
    .map((o) => ({ ...o, group: ministryGroup(o) }))
    .sort(
      (a, b) =>
        b.published - a.published ||
        b.cards - a.cards ||
        a.name.localeCompare(b.name, 'ko'),
    )
}

export async function readHome(
  sido: string | undefined,
  ministry: string | undefined,
): Promise<HomeData> {
  const { orgs, reports } = await readDirectory()
  const stats = sidoStats(orgs, reports)
  const ministries = ministryTiles(orgs)
  const chosen =
    ministries.find((m) => m.id === ministry) ??
    ministries.find((m) => m.group === 'bu')
  const theirs = chosen
    ? reports.filter(
        (r) => r.org === chosen.id || r.ministries.includes(chosen.id),
      )
    : []
  return {
    stats,
    panel: sidoPanel(
      orgs,
      reports,
      stats,
      pickSido(stats, sido),
      PANEL_REPORTS,
    ),
    ministries,
    ministry: chosen
      ? {
          org: chosen,
          top: heavyFirst(theirs).slice(0, PANEL_REPORTS),
          total: theirs.length,
        }
      : null,
  }
}

export interface RegionData {
  stats: Record<string, SidoStat>
  panel: SidoPanel
}

/** 지역 탭: 시도 하나의 기관 전체 */
export async function readRegion(
  sido: string | undefined,
): Promise<RegionData> {
  const { orgs, reports } = await readDirectory()
  const stats = sidoStats(orgs, reports)
  return {
    stats,
    panel: sidoPanel(orgs, reports, stats, pickSido(stats, sido), 0),
  }
}

/** 부처 탭: 중앙 기관 전체 */
export async function readMinistries(): Promise<Array<MinistryTile>> {
  const { orgs } = await readDirectory()
  return ministryTiles(orgs)
}
