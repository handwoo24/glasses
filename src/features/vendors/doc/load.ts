/**
 * 업체 리포트 문서(.md) → 화면 데이터(VendorReportDoc). 양식은 FORMAT.md.
 * 사업 리포트와 같은 문법·부품(reports/doc)을 쓰고, 구역과 축만 다르다.
 */
import { z } from 'zod'
import { formatDate } from '../../reports/format'
import { judgeDateStart } from '../../reports/doc/dates'
import { DocError } from '../../reports/doc/errors'
import { cited, plain } from '../../reports/doc/inline'
import { checkCites } from '../../reports/doc/load'
import { parseMarkdown } from '../../reports/doc/markdown'
import {
  parseActions,
  parseAxes,
  parseUnknowns,
  parseVerdict,
} from '../../reports/doc/parse-body'
import {
  parseChecks,
  parseDisclosure,
  parseSources,
  parseTimeline,
} from '../../reports/doc/parse-folds'
import { prepare, prepareAll } from '../../reports/doc/prepare'
import {
  labelledItem,
  renderFigure,
  renderInline,
  renderPanel,
} from '../../reports/doc/rich'
import { check, expectNodes, splitSections } from '../../reports/doc/sections'
import type { Section } from '../../reports/doc/sections'
import type { Panel } from '../../reports/report-doc'
import { ORG } from '#/pipeline/schemas'
import { VENDOR_AXES, VENDOR_AXIS_IDS } from '../axes'
import type { VendorReportDoc } from '../vendor-doc'

const FrontSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.literal('vendor'),
  program: z.string().regex(new RegExp(`^programs/${ORG}\\.[a-z0-9-]+$`)),
  project: z.string().min(1),
  vendor: z.string().min(1),
  bizno: z.string().regex(/^\d{3}-\d{2}-\d{5}$/),
  role: z.string().min(1),
  description: z.string().min(1),
  asOf: z.iso.date(),
  nextReview: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  facts: z.record(z.string(), z.string()),
  axisIndicators: z.partialRecord(z.enum(VENDOR_AXIS_IDS), z.string()),
  footNote: z.string().min(1),
})

/** ## 제목 → 구역 이름. 업체 리포트의 구역은 모두 정해진 제목이다 */
const SECTIONS = {
  '맡은 일': 'work',
  '종합 판정': 'verdict',
  '계약의 일생': 'life',
  '축별 근거': 'axes',
  '다른 공공 계약': 'context',
  '공개 문서 현황': 'disclosure',
  '아직 확인하지 못한 것': 'unknowns',
  '더 알아보는 방법': 'actions',
  점검표: 'checks',
  '진행 경과': 'timeline',
  출처: 'sources',
} as const
type Key = (typeof SECTIONS)[keyof typeof SECTIONS]
const REQUIRED: ReadonlyArray<Key> = [
  'work',
  'verdict',
  'axes',
  'unknowns',
  'actions',
  'checks',
  'timeline',
  'sources',
]

function sectionMap(sections: ReadonlyArray<Section>): Map<Key, Section> {
  const out = new Map<Key, Section>()
  for (const s of sections) {
    const key = SECTIONS[s.title as keyof typeof SECTIONS] as Key | undefined
    if (s.id || !key)
      throw new DocError(
        s.where,
        `알 수 없는 구역 (업체 리포트의 구역: ${Object.keys(SECTIONS).join(', ')})`,
      )
    if (out.has(key)) throw new DocError(s.where, '같은 구역이 두 번 나옴')
    out.set(key, s)
  }
  const missing = REQUIRED.filter((k) => !out.has(k))
  if (missing.length)
    throw new DocError('본문', `빠진 구역: ${missing.join(', ')}`)
  return out
}

function panel(s: Section): Panel {
  return { title: s.title, body: prepareAll(s.nodes, s.where) }
}

/** 본문 조각을 한 번 그려 본다. 정하지 않은 블록·링크가 있으면 여기서 실패한다 */
function checkRich(doc: VendorReportDoc): void {
  for (const p of [doc.work, doc.life, doc.context])
    if (p) renderPanel(p.body, p.title)
  for (const id of VENDOR_AXIS_IDS) {
    const { figure, note } = doc.axes[id]
    if (figure) renderFigure(figure, `축별 근거 > ${id} > 그림`)
    if (note) renderInline(note, `축별 근거 > ${id} > 참고`)
  }
  doc.moreActions.forEach((it, i) => labelledItem(it, '그 밖의 방법', i))
}

function prepareAxes(axes: VendorReportDoc['axes']): VendorReportDoc['axes'] {
  return Object.fromEntries(
    VENDOR_AXIS_IDS.map((id) => {
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
  ) as VendorReportDoc['axes']
}

export function loadVendorDoc(src: string): VendorReportDoc {
  const doc = readVendorDoc(src)
  checkRich(doc)
  return doc
}

function readVendorDoc(src: string): VendorReportDoc {
  const { front, root } = parseMarkdown(src)
  const f = check(FrontSchema, front, '머리말')
  const h1 = root.children.at(0)
  const lede = root.children.at(1)
  if (h1?.type !== 'heading' || h1.depth !== 1)
    throw new DocError('제목', '머리말 다음은 # 제목')
  const [ledeP] = expectNodes(lede ? [lede] : [], ['paragraph'], '리드')
  const { before, sections } = splitSections(root.children.slice(2), 2, '본문')
  expectNodes(before, [], '리드 다음')
  const s = sectionMap(sections)
  const get = (k: Key) => s.get(k) as Section
  const opt = <T>(k: Key, fn: (sec: Section) => T): T | undefined => {
    const sec = s.get(k)
    return sec && fn(sec)
  }
  const sources = parseSources(get('sources'))
  checkCites(
    src,
    sources.map((x) => x.id),
  )
  const { nextDates } = parseVerdict(get('verdict'), false)
  const { request, moreActions } = parseActions(get('actions'))
  return {
    slug: f.slug,
    program: f.program,
    project: f.project,
    vendor: f.vendor,
    bizno: f.bizno,
    role: f.role,
    title: plain(h1.children, '제목'),
    description: f.description,
    asOf: formatDate(f.asOf),
    facts: Object.entries(f.facts),
    lede: cited(ledeP.children, '리드'),
    axisIndicators: f.axisIndicators,
    work: panel(get('work')),
    nextDates: nextDates.map((d) => {
      const date = judgeDateStart(d.when, f.asOf)
      return date ? { ...d, date } : d
    }),
    life: opt('life', panel),
    axes: prepareAxes(parseAxes(get('axes'), VENDOR_AXES)),
    context: opt('context', panel),
    disclosure: opt('disclosure', parseDisclosure) ?? [],
    unknowns: parseUnknowns(get('unknowns')),
    nextReview: formatDate(f.nextReview),
    request,
    moreActions: moreActions.map((it) => prepare(it, '그 밖의 방법')),
    footNote: f.footNote,
    ...parseChecks(get('checks'), VENDOR_AXES),
    sources,
    timeline: parseTimeline(get('timeline')),
  }
}
