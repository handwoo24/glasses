// 시민이 읽는 본문 구역: 사업 개요, 종합 판정, 축별 근거, 아직 확인하지 못한 것, 더 알아보는 방법.
import { ANY_AXES, EVIDENCE_INFO, STATUS_INFO } from '../axes'
import type { AxisId, AxisSet } from '../axes'
import type { Cited, OverviewCell, UnknownItem } from '../assessment'
import { fromLabel } from '../labels'
import { cited, itemParagraphs, lead, plain, requireLead } from './inline'
import type { Lead } from './inline'
import { DocError } from './errors'
import { expectNodes, namedSections, splitSections } from './sections'
import type { Section } from './sections'
import { FACT_KINDS } from '../report-doc'
import type { AxisDoc, AxisFact, ReportDoc } from '../report-doc'
import type { ListItem, List, Paragraph, RootContent, Table } from 'mdast'

const OVERVIEW_LABELS = ['무엇', '얼마', '누가', '언제'] as const

export function tableRows(
  table: Table,
  header: ReadonlyArray<string>,
  where: string,
) {
  const [head, ...rows] = table.children
  const got = head.children.map((c) => plain(c.children, where))
  if (got.join('|') !== header.join('|'))
    throw new DocError(
      where,
      `표 머리는 | ${header.join(' | ')} | (지금: | ${got.join(' | ')} |)`,
    )
  return rows.map((r, i) => {
    if (r.children.length !== header.length)
      throw new DocError(
        where,
        `${i + 1}번째 줄: 칸이 ${header.length}개여야 함 (지금 ${r.children.length}개)`,
      )
    return r.children.map((c) => c.children)
  })
}

/** 목록 항목마다 첫 문단의 라벨을 읽고, 나머지 문단은 그대로 넘긴다 */
export function leadItems(
  list: List,
  where: string,
  variants: ReadonlyArray<string> = [],
): Array<{ lead: Lead; more: Array<Paragraph> }> {
  return list.children.map((item) => {
    const [first, ...more] = itemParagraphs(item, where)
    return { lead: requireLead(first, where, variants), more }
  })
}

export function parseOverview(sec: Section): ReportDoc['overview'] {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  const [table] = expectNodes(before, ['table'], sec.where)
  const cells = tableRows(table, ['구분', '요약', '설명'], sec.where).map(
    (row): OverviewCell => {
      const [text, ...cite] = cited(row[2], sec.where)
      return {
        label: plain(row[0], sec.where) as OverviewCell['label'],
        value: plain(row[1], sec.where),
        text,
        cite,
      }
    },
  )
  const labels = cells.map((c) => c.label)
  if (labels.join('·') !== OVERVIEW_LABELS.join('·'))
    throw new DocError(
      sec.where,
      `구분은 ${OVERVIEW_LABELS.join('·')} 순서로 한 번씩 (지금: ${labels.join('·')})`,
    )
  if (sections.length > 1)
    throw new DocError(sec.where, '### 묶음(칩)은 하나만')
  const chip = sections.at(0)
  if (!chip) return { cells }
  const [label, ...cite] = cited(chip.heading.children, chip.where)
  const [list] = expectNodes(chip.nodes, ['list'], chip.where)
  const chipItems = list.children.map((it) => {
    const [p, ...extra] = itemParagraphs(it, chip.where)
    if (extra.length) throw new DocError(chip.where, '항목은 한 문단')
    const [first] = p.children
    return p.children.length === 1 && first.type === 'strong'
      ? { label: plain(first.children, chip.where), on: true }
      : { label: plain(p.children, chip.where) }
  })
  return { cells, chips: { label, cite, items: chipItems } }
}

/**
 * 종합 판정: ### 다음 판단 시점 목록. 판정 문단은 쓰지 않는다(판정은 축 상태로 계산하고, 화면에 나오지 않는다).
 * oldParagraph면 판정 문단이 있는 옛 판도 읽는다(문장 규칙이 새로 쓰는 판을 막는다)
 */
export function parseVerdict(sec: Section, oldParagraph = false) {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  const [p] = expectNodes(
    before,
    oldParagraph && before.length ? ['paragraph'] : [],
    sec.where,
  )
  const next = namedSections(sections, ['다음 판단 시점'], sec.where).get(
    '다음 판단 시점',
  )
  if (!next) throw new DocError(sec.where, '### 다음 판단 시점이 필요함')
  const [list] = expectNodes(next.nodes, ['list'], next.where)
  const nextDates = leadItems(list, next.where).map(({ lead: l }) => ({
    when: l.label,
    what: plain(l.rest, next.where),
  }))
  return { verdict: p ? plain(p.children, sec.where) : '', nextDates }
}

function axisHeading<TAxis extends string>(
  title: string,
  where: string,
  set: AxisSet<TAxis>,
): {
  id: TAxis
  status: AxisDoc['status']
  evidence: AxisDoc['evidence']
} {
  const parts = title.split(' · ')
  const [name, statusLabel, evLabel] = parts
  const id = set.ids.find((a) => set.name(a) === name)
  const status = fromLabel(
    Object.fromEntries(
      Object.entries(STATUS_INFO).map(([k, v]) => [k, v.label]),
    ) as Record<AxisDoc['status'], string>,
    statusLabel,
  )
  const evidence = fromLabel(
    Object.fromEntries(
      Object.entries(EVIDENCE_INFO).map(([k, v]) => [k, `근거 ${v.label}`]),
    ) as Record<AxisDoc['evidence'], string>,
    evLabel,
  )
  if (parts.length !== 3 || !id || !status || !evidence)
    throw new DocError(
      where,
      '축 제목은 "④ 비용 · 개선 필요 · 근거 일부" 형식 (상태: 순항·지켜볼 점·개선 필요·판단 불가, 근거: 충분·일부·부족)',
    )
  return { id, status, evidence }
}

function citedList(list: List, where: string): Array<Cited> {
  return list.children.map((it) => {
    const ps = itemParagraphs(it, where)
    if (ps.length !== 1) throw new DocError(where, '항목은 한 문단')
    return cited(ps[0].children, where)
  })
}

/** 사실 목록: 항목 첫머리의 **발언** **문서** **계산**은 근거 종류(선택) */
function factList(list: List, where: string): Array<AxisFact> {
  return list.children.map((it) => {
    const ps = itemParagraphs(it, where)
    if (ps.length !== 1) throw new DocError(where, '항목은 한 문단')
    const l = lead(ps[0], where)
    if (!l) return { cited: cited(ps[0].children, where) }
    const kind = FACT_KINDS.find((k) => k === l.label)
    if (!kind)
      throw new DocError(
        where,
        `사실 앞 라벨은 ${FACT_KINDS.map((k) => `**${k}**`).join(' ')}만 (지금: **${l.label}**)`,
      )
    return { kind, cited: cited(l.rest, where) }
  })
}

type AxisBody = Omit<AxisDoc, 'status' | 'evidence'>
/** 목록 앞에 오는 라벨 문단. 옛 문서의 ‘시의 설명’도 받는다 */
const SAID_LABELS = ['기관의 설명', '시의 설명']
const SAID = '기관의 설명'

/** 축 블록 하나를 읽는다. 같은 블록이 두 번 나오면 앞의 것이 사라지지 않게 실패 */
function axisBlock(
  n: RootContent,
  saidNext: boolean,
  where: string,
): [keyof AxisBody | typeof SAID, unknown] {
  if (n.type === 'blockquote') {
    const [p] = expectNodes(n.children, ['paragraph'], where)
    return ['line', plain(p.children, where)]
  }
  if (n.type === 'heading' && n.depth === 4)
    return ['title', plain(n.children, where)]
  if (n.type === 'list')
    return saidNext
      ? ['said', citedList(n, where)]
      : ['facts', factList(n, where)]
  if (n.type === 'containerDirective' && n.name === 'figure') {
    if (Object.keys(n.attributes ?? {}).length)
      throw new DocError(where, '::::figure에는 속성을 쓰지 않는다')
    return ['figure', n.children]
  }
  if (n.type !== 'paragraph')
    throw new DocError(where, `축 안에 쓸 수 없는 블록: ${n.type}`)
  const l = requireLead(n, where)
  if (SAID_LABELS.includes(l.label) && l.rest.length === 0) return [SAID, true]
  if (l.label === '시민 단위') return ['per', plain(l.rest, where)]
  if (l.label === '참고') return ['note', l.rest]
  if (l.label === '확인 못 한 것') return ['missing', plain(l.rest, where)]
  throw new DocError(where, `알 수 없는 라벨 **${l.label}**`)
}

const BLOCK_NAME: Partial<Record<keyof AxisBody | typeof SAID, string>> = {
  line: '> 한 줄 요약',
  title: '#### 제목',
  facts: '사실 목록 (그림 안 목록은 ::::figure 안에)',
  figure: '::::figure',
  per: '**시민 단위**',
  note: '**참고**',
  missing: '**확인 못 한 것**',
  [SAID]: '**기관의 설명**',
}

/** 축 하나: > 한 줄, #### 제목, 사실 목록, ::::figure, **시민 단위**, **기관의 설명**, **참고**, **확인 못 한 것** */
function parseAxis(nodes: ReadonlyArray<RootContent>, where: string): AxisBody {
  const seen = new Set<string>()
  const out: Record<string, unknown> = {}
  let saidNext = false
  for (const n of nodes) {
    if (saidNext && n.type !== 'list')
      throw new DocError(where, '**기관의 설명** 다음에는 목록')
    const [key, value] = axisBlock(n, saidNext, where)
    if (seen.has(key))
      throw new DocError(where, `${BLOCK_NAME[key] ?? key}가 두 번 나옴`)
    seen.add(key)
    saidNext = key === SAID
    if (!saidNext) out[key] = value
  }
  if (saidNext) throw new DocError(where, '**기관의 설명** 다음에는 목록')
  if (!out.line || !out.title)
    throw new DocError(where, '> 한 줄 요약과 #### 제목이 필요함')
  return out as unknown as AxisBody
}

export function parseAxes(sec: Section): Record<AxisId, AxisDoc>
export function parseAxes<TAxis extends string>(
  sec: Section,
  set: AxisSet<TAxis>,
): Record<TAxis, AxisDoc>
export function parseAxes(
  sec: Section,
  set: AxisSet<string> = ANY_AXES,
): Record<string, AxisDoc> {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  expectNodes(before, [], sec.where)
  const axes = sections.map((s) => {
    const { id, status, evidence } = axisHeading(s.title, s.where, set)
    return [id, { status, evidence, ...parseAxis(s.nodes, s.where) }] as const
  })
  const order = axes.map(([id]) => id).join(',')
  if (order !== set.ids.join(','))
    throw new DocError(
      sec.where,
      `${set.ids.length}개 축이 ${set.name(set.ids[0]).slice(0, 1)}~${set.name(set.ids[set.ids.length - 1]).slice(0, 1)} 순서로 하나씩 있어야 함 (지금: ${order})`,
    )
  return Object.fromEntries(axes)
}

export function parseUnknowns(sec: Section): Array<UnknownItem> {
  const [list] = expectNodes(sec.nodes, ['list'], sec.where)
  return leadItems(list, sec.where, ['req']).map(({ lead: l }) => {
    const [text, ...cite] = cited(l.rest, sec.where)
    return { label: l.label, text, requested: l.variant === 'req', cite }
  })
}

export function parseActions(sec: Section): {
  request: string
  moreActions: Array<ListItem>
} {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  expectNodes(before, [], sec.where)
  const named = namedSections(
    sections,
    ['정보공개청구 문구', '그 밖의 방법'],
    sec.where,
  )
  const req = named.get('정보공개청구 문구')
  if (!req) throw new DocError(sec.where, '### 정보공개청구 문구가 필요함')
  const [code] = expectNodes(req.nodes, ['code'], req.where)
  const more = named.get('그 밖의 방법')
  if (!more) return { request: code.value, moreActions: [] }
  const [list] = expectNodes(more.nodes, ['list'], more.where)
  return { request: code.value, moreActions: list.children }
}
