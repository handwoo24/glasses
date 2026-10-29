/**
 * 리포트 문서(.md) → 화면 데이터(ReportDoc). 양식은 FORMAT.md.
 * 저장 위치(git, Firestore, Storage)와 무관하게 문자열만 받는다. 양식이 틀리면 어느 구역이 틀렸는지와 함께 실패한다.
 */
import { z } from 'zod'
import { AXIS_IDS } from '../axes'
import { formatDate } from '../format'
import type { Panel, ReportDoc } from '../report-doc'
import { cited, plain } from './inline'
import { DocError } from './errors'
import { parseMarkdown } from './markdown'
import {
  parseActions,
  parseAxes,
  parseOverview,
  parseUnknowns,
  parseVerdict,
} from './parse-body'
import {
  parseBudget,
  parseChecks,
  parseContracts,
  parseDisclosure,
  parseOversight,
  parseSources,
  parseTimeline,
} from './parse-folds'
import { prepare, prepareAll } from './prepare'
import { labelledItem, renderFigure, renderInline, renderPanel } from './rich'
import { judgeDateStart } from './dates'
import { check, expectNodes, splitSections } from './sections'
import type { Section } from './sections'

const FrontSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  project: z.string().min(1),
  description: z.string().min(1),
  asOf: z.iso.date(),
  nextReview: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  facts: z.record(z.string(), z.string()),
  typeNote: z.string().min(1).optional(),
  axisIndicators: z.partialRecord(z.enum(AXIS_IDS), z.string()),
  footNote: z.string().min(1),
})

/** ## 제목 → 구역 이름. 문서마다 제목이 다른 패널은 {#side} 같은 표시로 찾는다 */
const FIXED = {
  '사업 개요': 'overview',
  '종합 판정': 'verdict',
  '축별 근거': 'axes',
  '아직 확인하지 못한 것': 'unknowns',
  '더 알아보는 방법': 'actions',
  점검표: 'checks',
  '예산이 정해진 과정': 'budget',
  '계약 상세': 'contracts',
  '감사·점검 이력': 'oversight',
  '공개 문서 현황': 'disclosure',
  '진행 경과': 'timeline',
  출처: 'sources',
} as const
const PANELS = ['side', 'status', 'vendors'] as const
const REQUIRED = [
  'overview',
  'side',
  'verdict',
  'status',
  'axes',
  'unknowns',
  'actions',
  'checks',
  'timeline',
  'sources',
]

type Key = (typeof FIXED)[keyof typeof FIXED] | (typeof PANELS)[number]

function sectionMap(sections: ReadonlyArray<Section>): Map<Key, Section> {
  const out = new Map<Key, Section>()
  for (const s of sections) {
    if (s.id && s.title in FIXED)
      throw new DocError(
        s.where,
        `{#${s.id}}는 문서마다 제목이 다른 패널에만 붙인다`,
      )
    const key: Key | undefined = s.id
      ? (PANELS as ReadonlyArray<string>).includes(s.id)
        ? (s.id as Key)
        : undefined
      : FIXED[s.title as keyof typeof FIXED]
    if (!key)
      throw new DocError(
        s.where,
        `알 수 없는 구역 (정해진 제목이나 {#side}·{#status}·{#vendors} 표시)`,
      )
    if (out.has(key)) throw new DocError(s.where, '같은 구역이 두 번 나옴')
    out.set(key, s)
  }
  const missing = REQUIRED.filter((k) => !out.has(k as Key))
  if (missing.length)
    throw new DocError('본문', `빠진 구역: ${missing.join(', ')}`)
  return out
}

/** 본문에 쓴 출처 [sN]이 모두 출처 표에 있는지. 코드 블록(청구 문구 등) 안은 출처가 아니다 */
export function checkCites(
  body: string,
  sourceIds: ReadonlyArray<string>,
): void {
  const known = new Set(sourceIds)
  const prose = body.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, '')
  const unknown = [
    ...new Set([...prose.matchAll(/\[(s\d+)\]/g)].map((m) => m[1])),
  ].filter((id) => !known.has(id))
  if (unknown.length)
    throw new DocError('출처', `출처 표에 없는 id: ${unknown.join(', ')}`)
}

function panel(s: Section): Panel {
  return { title: s.title, body: prepareAll(s.nodes, s.where) }
}

/** 본문 조각(안내, 그림 등)을 한 번 그려 본다. 정하지 않은 블록·링크가 있으면 여기서 실패한다 */
function checkRich(doc: ReportDoc): void {
  for (const p of [doc.side, doc.status, doc.vendors])
    if (p) renderPanel(p.body, p.title)
  for (const id of AXIS_IDS) {
    const { figure, note } = doc.axes[id]
    if (figure) renderFigure(figure, `축별 근거 > ${id} > 그림`)
    if (note) renderInline(note, `축별 근거 > ${id} > 참고`)
  }
  doc.moreActions.forEach((it, i) => labelledItem(it, '그 밖의 방법', i))
}

/** 축 그림·참고를 브라우저로 보낼 모양으로 */
function prepareAxes(axes: ReportDoc['axes']): ReportDoc['axes'] {
  return Object.fromEntries(
    AXIS_IDS.map((id) => {
      const a = axes[id]
      const where = `축별 근거 > ${id}`
      return [
        id,
        {
          ...a,
          figure: a.figure && prepareAll(a.figure, `${where} > 그림`),
          note: a.note && prepareAll(a.note, `${where} > 참고`),
        },
      ]
    }),
  ) as ReportDoc['axes']
}

export function loadReportDoc(src: string): ReportDoc {
  const doc = readReportDoc(src)
  checkRich(doc)
  return doc
}

function readReportDoc(src: string): ReportDoc {
  const { front, root } = parseMarkdown(src)
  const f = check(FrontSchema, front, '머리말')
  const h1 = root.children.at(0)
  const lede = root.children.at(1)
  const body = root.children.slice(2)
  if (h1?.type !== 'heading' || h1.depth !== 1)
    throw new DocError('제목', '머리말 다음은 # 제목')
  const [ledeP] = expectNodes(lede ? [lede] : [], ['paragraph'], '리드')
  const { before, sections } = splitSections(body, 2, '본문')
  expectNodes(before, [], '리드 다음')
  const s = sectionMap(sections)
  const get = (k: Key) => s.get(k) as Section
  const sources = parseSources(get('sources'))
  checkCites(
    src,
    sources.map((x) => x.id),
  )
  const opt = <T>(k: Key, fn: (sec: Section) => T): T | undefined => {
    const sec = s.get(k)
    return sec && fn(sec)
  }
  const { verdict, nextDates } = parseVerdict(get('verdict'), true)
  const { request, moreActions } = parseActions(get('actions'))
  const actions = {
    request,
    moreActions: moreActions.map((it) => prepare(it, '그 밖의 방법')),
  }
  return {
    slug: f.slug,
    project: f.project,
    title: plain(h1.children, '제목'),
    description: f.description,
    asOf: formatDate(f.asOf),
    facts: Object.entries(f.facts),
    lede: cited(ledeP.children, '리드'),
    typeNote: f.typeNote,
    axisIndicators: f.axisIndicators,
    overview: parseOverview(get('overview')),
    side: panel(get('side')),
    verdict,
    nextDates: nextDates.map((d) => {
      const date = judgeDateStart(d.when, f.asOf)
      return date ? { ...d, date } : d
    }),
    status: panel(get('status')),
    axes: prepareAxes(parseAxes(get('axes'))),
    vendors: opt('vendors', panel),
    unknowns: parseUnknowns(get('unknowns')),
    nextReview: formatDate(f.nextReview),
    ...actions,
    footNote: f.footNote,
    ...parseChecks(get('checks')),
    sources,
    budgetBasis: opt('budget', parseBudget),
    contracts: opt('contracts', parseContracts),
    oversight: opt('oversight', parseOversight) ?? [],
    disclosure: opt('disclosure', parseDisclosure) ?? [],
    timeline: parseTimeline(get('timeline')),
  }
}
