// '자세히 보기'와 출처 구역: 점검표, 예산 과정, 계약, 감사, 공개 문서, 진행 경과, 출처.
import { parse as parseYaml } from 'yaml'
import { AXIS_IDS, AXIS_INFO } from '../axes'
import type { AxisId } from '../axes'
import { ANSWER_INFO } from '../assessment'
import type { Answer, ClassifiedCheck } from '../assessment'
import {
  DISCLOSURE_LABEL,
  DUTY_LABEL,
  OVERSIGHT_LABEL,
  REQUEST_LABEL,
  SEVERITY_LABEL,
  SIGNAL_LABEL,
  fromLabel,
} from '../labels'
import {
  BudgetBasisSchema,
  ContractSchema,
  DisclosureItemSchema,
  OversightSchema,
  RiskSignalSchema,
  SourceSchema,
  TimelineItemSchema,
} from '../schema'
import type {
  BudgetBasis,
  Contract,
  DisclosureItem,
  Oversight,
  RiskSignal,
  Source,
  TimelineItem,
} from '../schema'
import { cited, labelledText, plain } from './inline'
import { DocError } from './errors'
import { leadItems, tableRows } from './parse-body'
import { check, expectNodes, namedSections, splitSections } from './sections'
import type { Section } from './sections'
import type { List } from 'mdast'

const ANSWER_LABEL = Object.fromEntries(
  Object.entries(ANSWER_INFO).map(([k, v]) => [k, v.label]),
) as Record<Answer, string>

/** **라벨 · 라벨** 을 정한 라벨 사전들로 읽는다 */
function labels<T extends Array<Record<string, string>>>(
  text: string,
  dicts: T,
  where: string,
): { [K in keyof T]: keyof T[K] } {
  const parts = text.split(' · ')
  if (parts.length !== dicts.length)
    throw new DocError(
      where,
      `라벨 ${dicts.length}개를 " · "로 이어 쓴다: ${text}`,
    )
  return dicts.map((d, i) => {
    const v = fromLabel(d, parts[i])
    if (!v)
      throw new DocError(
        where,
        `"${parts[i]}"는 쓸 수 없는 라벨 (${Object.values(d).join(', ')})`,
      )
    return v
  }) as { [K in keyof T]: keyof T[K] }
}

function checkItems(
  list: List,
  axis: AxisId,
  where: string,
): Array<ClassifiedCheck> {
  return leadItems(list, where).map(({ lead, more }) => {
    const [answer] = labels(lead.label, [ANSWER_LABEL], where)
    const [question, ...cite] = cited(lead.rest, where)
    const w = `${where} > ${question}`
    if (more.length !== 2)
      throw new DocError(w, '발견 문단과 **판단 기준** 문단이 필요함')
    const finding = plain(more[0].children, w)
    const criterion = labelledText(more[1], '판단 기준', w)
    return { axis, answer, question, finding, criterion, cite }
  })
}

function signalItems(list: List, where: string): Array<RiskSignal> {
  return leadItems(list, where).map(({ lead, more }) => {
    const [status, severity] = labels(
      lead.label,
      [SIGNAL_LABEL, SEVERITY_LABEL],
      where,
    )
    const [signal, ...cite] = cited(lead.rest, where)
    const [detail] = expectNodes(more, ['paragraph'], `${where} > ${signal}`)
    return check(
      RiskSignalSchema,
      { signal, status, severity, detail: plain(detail.children, where), cite },
      where,
    )
  })
}

export function parseChecks(sec: Section) {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  expectNodes(before, [], sec.where)
  const titles = AXIS_IDS.map((a) => `${AXIS_INFO[a].no} ${AXIS_INFO[a].label}`)
  const named = namedSections(sections, titles, sec.where)
  const checks: Array<ClassifiedCheck> = []
  const signals = Object.fromEntries(
    AXIS_IDS.map((a) => [a, [] as Array<RiskSignal>]),
  ) as Record<AxisId, Array<RiskSignal>>
  AXIS_IDS.forEach((axis, i) => {
    const s = named.get(titles[i])
    if (!s) return
    const inner = splitSections(s.nodes, 4, s.where)
    const lists = expectNodes(
      inner.before,
      inner.before.length ? ['list'] : [],
      s.where,
    )
    checks.push(...lists.flatMap((l) => checkItems(l, axis, s.where)))
    const sig = namedSections(inner.sections, ['관련 지표'], s.where).get(
      '관련 지표',
    )
    if (sig)
      signals[axis] = signalItems(
        expectNodes(sig.nodes, ['list'], sig.where)[0],
        sig.where,
      )
  })
  return { checks, signals }
}

export function parseBudget(sec: Section): BudgetBasis {
  const [intro, list] = expectNodes(sec.nodes, ['paragraph', 'list'], sec.where)
  const steps = leadItems(list, sec.where).map(({ lead }) => {
    const [detail, ...cite] = cited(lead.rest, sec.where)
    return { label: lead.label, detail, cite }
  })
  return check(
    BudgetBasisSchema,
    { intro: plain(intro.children, sec.where), steps },
    sec.where,
  )
}

export function parseContracts(sec: Section): {
  intro: string
  items: Array<Contract>
} {
  const { before, sections } = splitSections(sec.nodes, 3, sec.where)
  const [intro] = expectNodes(before, ['paragraph'], sec.where)
  const items = sections.map((s) => {
    const [name, ...cite] = cited(s.heading.children, s.where)
    const [code] = expectNodes(s.nodes, ['code'], s.where)
    if (code.lang !== 'yaml')
      throw new DocError(s.where, '계약 내용은 ```yaml 블록')
    const data: unknown = parseYaml(code.value)
    if (typeof data !== 'object' || data === null)
      throw new DocError(s.where, 'yaml이 비어 있음')
    return check(ContractSchema, { name, ...data, cite }, s.where)
  })
  return { intro: plain(intro.children, sec.where), items }
}

export function parseOversight(sec: Section): Array<Oversight> {
  const [list] = expectNodes(sec.nodes, ['list'], sec.where)
  return leadItems(list, sec.where).map(({ lead, more }) => {
    const [statusLabel, ...whenParts] = lead.label.split(' · ')
    const [status] = labels(statusLabel, [OVERSIGHT_LABEL], sec.where)
    const [body, ...cite] = cited(lead.rest, sec.where)
    const w = `${sec.where} > ${body}`
    const [finding, after] = expectNodes(more, ['paragraph', 'paragraph'], w)
    return check(
      OversightSchema,
      {
        body,
        when: whenParts.join(' · '),
        status,
        finding: plain(finding.children, w),
        followUp: labelledText(after, '그 뒤', w),
        cite,
      },
      w,
    )
  })
}

export function parseDisclosure(sec: Section): Array<DisclosureItem> {
  const [list] = expectNodes(sec.nodes, ['list'], sec.where)
  return leadItems(list, sec.where).map(({ lead, more }) => {
    const [status, duty, request] = labels(
      lead.label,
      [DISCLOSURE_LABEL, DUTY_LABEL, REQUEST_LABEL],
      sec.where,
    )
    const [doc, ...cite] = cited(lead.rest, sec.where)
    const [note] = expectNodes(more, ['paragraph'], `${sec.where} > ${doc}`)
    return check(
      DisclosureItemSchema,
      {
        doc,
        status,
        duty,
        request,
        note: plain(note.children, sec.where),
        cite,
      },
      sec.where,
    )
  })
}

export function parseTimeline(sec: Section): Array<TimelineItem> {
  const [table] = expectNodes(sec.nodes, ['table'], sec.where)
  return tableRows(table, ['날짜', '내용'], sec.where).map((row) => {
    const [label, ...cite] = cited(row[1], sec.where)
    return check(
      TimelineItemSchema,
      { date: plain(row[0], sec.where), label, cite },
      sec.where,
    )
  })
}

const SOURCE_HEADER = ['id', '자료', '기관', '종류', '날짜', '위치', '이용조건']

export function parseSources(sec: Section): Array<Source> {
  const [table] = expectNodes(sec.nodes, ['table'], sec.where)
  const sources = tableRows(table, SOURCE_HEADER, sec.where).map((row) => {
    const [id, doc, org, kind, date, locator, license] = row
    const [link] = doc
    if (doc.length !== 1 || link.type !== 'link')
      throw new DocError(sec.where, '자료 칸은 [제목](주소) 링크 하나')
    const where = `${sec.where} > ${plain(id, sec.where)}`
    return check(
      SourceSchema,
      {
        id: plain(id, where),
        title: plain(link.children, where),
        org: plain(org, where),
        kind: plain(kind, where),
        date: plain(date, where),
        url: link.url,
        license: plain(license, where),
        locator: plain(locator, where) || undefined,
      },
      where,
    )
  })
  const seen = new Set<string>()
  for (const { id } of sources) {
    if (seen.has(id))
      throw new DocError(sec.where, `출처 id ${id}이 두 번 나옴`)
    seen.add(id)
  }
  return sources
}
