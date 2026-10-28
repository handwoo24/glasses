// 문서의 자유 본문(안내, 현황, 그림, 표)을 디자인 시스템 마크업으로 그린다.
// 정해진 블록만 그리고, 모르는 블록·HTML·허용되지 않은 링크는 오류로 막는다.
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { Cite } from '../components/cite'
import { formatDate } from '../format'
import { LinkUrlSchema } from '../schema'
import { DownArrow, HBars } from '../view/parts'
import {
  CITE_RUN,
  citeIds,
  itemParagraphs,
  lead,
  plain,
  requireLead,
  trimEnd,
} from './inline'
import { DocError } from './errors'
import type { ContainerDirective } from 'mdast-util-directive'
import type { List, ListItem, PhrasingContent, RootContent, Table } from 'mdast'

type Blocks = ReadonlyArray<RootContent>

function withCites(text: string, key: string): Array<ReactNode> {
  const out: Array<ReactNode> = []
  let at = 0
  for (const m of text.matchAll(CITE_RUN)) {
    if (m.index > at) out.push(text.slice(at, m.index))
    out.push(<Cite key={`${key}-${m.index}`} ids={citeIds(m[1])} />)
    at = m.index + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

export function renderInline(
  nodes: ReadonlyArray<PhrasingContent>,
  where: string,
): Array<ReactNode> {
  return nodes.flatMap((n, i): Array<ReactNode> => {
    switch (n.type) {
      case 'text':
        return withCites(n.value, String(i))
      case 'strong':
        return [<b key={i}>{renderInline(n.children, where)}</b>]
      case 'break':
        return [<br key={i} />]
      case 'link': {
        const url = LinkUrlSchema.safeParse(n.url)
        if (!url.success)
          throw new DocError(where, `허용되지 않은 링크: ${n.url}`)
        return [
          <a key={i} href={url.data} target="_blank" rel="noopener noreferrer">
            {renderInline(n.children, where)}
          </a>,
        ]
      }
      case 'textDirective':
        if (n.name === 'grp')
          return [
            <span key={i} className="grp">
              {renderInline(n.children, where)}
            </span>,
          ]
        throw new DocError(where, `이 자리에 쓸 수 없는 지시자 :${n.name}`)
      default:
        throw new DocError(where, `본문에 쓸 수 없는 표기: ${n.type}`)
    }
  })
}

function items(list: List, where: string): Array<ListItem> {
  if (list.ordered) throw new DocError(where, '번호 목록은 쓰지 않음')
  return list.children
}

function only(item: ListItem, where: string) {
  const ps = itemParagraphs(item, where)
  if (ps.length !== 1) throw new DocError(where, '항목은 한 문단이어야 함')
  return ps[0]
}

/** - **라벨** 내용 → <span class="k">라벨</span>내용 */
export function labelledItem(
  item: ListItem,
  where: string,
  key: number,
): ReactNode {
  const p = only(item, where)
  const l = lead(p, where, ['req'])
  if (!l) return <li key={key}>{renderInline(p.children, where)}</li>
  return (
    <li key={key}>
      <span className={l.variant === 'req' ? 'k req' : 'k'}>{l.label}</span>
      {renderInline(l.rest, where)}
    </li>
  )
}

/** 블록 지시자마다 쓸 수 있는 속성. 나머지 속성은 오류 */
const DIRECTIVE_ATTRS: Partial<Record<string, ReadonlyArray<string>>> = {
  'next-date': ['date'],
  split: ['label'],
}

function directive(d: ContainerDirective, where: string) {
  const attrs = d.attributes ?? {}
  const allowed = DIRECTIVE_ATTRS[d.name] ?? []
  const extra = Object.keys(attrs).filter((k) => !allowed.includes(k))
  if (extra.length)
    throw new DocError(
      where,
      `:::${d.name}에 쓸 수 없는 속성 ${extra.join(', ')}`,
    )
  const first = d.children.at(0)
  const rest = d.children.slice(1)
  const labelled = first?.type === 'paragraph' && first.data?.directiveLabel
  return {
    label: labelled ? plain(first.children, where) : undefined,
    attrs,
    body: labelled ? rest : d.children,
  }
}

function single<T extends RootContent['type']>(
  body: Blocks,
  type: T,
  where: string,
): Extract<RootContent, { type: T }> {
  if (body.length !== 1 || body[0].type !== type)
    throw new DocError(where, `이 블록 안에는 ${type} 하나만 쓴다`)
  return body[0] as Extract<RootContent, { type: T }>
}

function dataTable(
  table: Table,
  where: string,
  caption?: string,
  key?: number,
): ReactNode {
  const [head, ...rows] = table.children
  return (
    <div key={key} className="tbl">
      <table>
        {caption && <caption className="label">{caption}</caption>}
        <thead>
          <tr>
            {head.children.map((c, i) => (
              <th key={i} scope="col">
                {renderInline(c.children, where)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.children.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {renderInline(c.children, where)}
                  </th>
                ) : (
                  <td
                    key={j}
                    className={table.align?.[j] === 'right' ? 'n' : undefined}
                  >
                    {renderInline(c.children, where)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 머리줄 아래 칸이 모두 td인 작은 표. 오른쪽 정렬(---:) 칸은 숫자 칸 */
function miniTable(table: Table, where: string, key: number): ReactNode {
  const [head, ...rows] = table.children
  return (
    <table key={key} className="mini-table">
      <thead>
        <tr>
          {head.children.map((c, i) => (
            <th key={i} scope="col">
              {renderInline(c.children, where)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.children.map((c, j) => (
              <td
                key={j}
                className={table.align?.[j] === 'right' ? 'n' : undefined}
              >
                {renderInline(c.children, where)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function panelDirective(d: ContainerDirective, where: string): ReactNode {
  const w = `${where} > :::${d.name}`
  const { label, attrs, body } = directive(d, w)
  switch (d.name) {
    case 'routes':
      return (
        <ul className="routes">
          {items(single(body, 'list', w), w).map((it, i) => {
            const l = requireLead(only(it, w), w, ['night'])
            return (
              <li key={i}>
                <span className={l.variant === 'night' ? 'rt night' : 'rt'}>
                  {l.label}
                </span>
                <span>{renderInline(l.rest, w)}</span>
              </li>
            )
          })}
        </ul>
      )
    case 'kv':
      return (
        <dl className="kv">
          {items(single(body, 'list', w), w).map((it, i) => {
            const l = requireLead(only(it, w), w)
            return (
              <div key={i}>
                <dt>{l.label}</dt>
                <dd>{renderInline(l.rest, w)}</dd>
              </div>
            )
          })}
        </dl>
      )
    case 'next-date': {
      const date = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/)
        .safeParse(attrs.date)
      if (!label || !date.success)
        throw new DocError(
          w,
          ':::next-date[라벨]{date=YYYY-MM-DD 또는 YYYY-MM} 형식',
        )
      return (
        <>
          <p className="label">{label}</p>
          <p className="big-date">{formatDate(date.data)}</p>
          <p className="small-soft">
            {renderInline(single(body, 'paragraph', w).children, w)}
          </p>
        </>
      )
    }
    case 'table':
      return dataTable(single(body, 'table', w), w, label)
    default:
      throw new DocError(where, `본문에 쓸 수 없는 블록 :::${d.name}`)
  }
}

/** 안내·현황·참여 기관 같은 패널 본문 */
export function renderPanel(nodes: Blocks, where: string): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'paragraph':
        return (
          <p key={i} className="cap">
            {renderInline(n.children, where)}
          </p>
        )
      case 'heading':
        return (
          <h4 key={i} className="sub-h">
            {renderInline(n.children, where)}
          </h4>
        )
      case 'list':
        return (
          <ul key={i} className="list">
            {items(n, where).map((it, j) => labelledItem(it, where, j))}
          </ul>
        )
      case 'table':
        return miniTable(n, where, i)
      case 'code':
        return chart(n.lang, n.value, where, i)
      case 'containerDirective':
        return <Fragment key={i}>{panelDirective(n, where)}</Fragment>
      default:
        throw new DocError(where, `패널 본문에 쓸 수 없는 블록: ${n.type}`)
    }
  })
}

export const BarsSchema = z.object({
  label: z.string().min(1),
  bars: z
    .array(
      z.object({
        year: z.string().min(1),
        text: z.string().min(1),
        height: z.number().positive(),
        hot: z.boolean().optional(),
      }),
    )
    .min(2),
})

export const HBarsSchema = z.object({
  label: z.string().min(1).optional(),
  /** 막대 100%에 해당하는 값. 비율이면 100 */
  max: z.number().positive().optional(),
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.number().nonnegative(),
        text: z.string().min(1),
        hot: z.boolean().optional(),
      }),
    )
    .min(1),
})

/** 막대 블록 이름 → 데이터 양식. 문서에는 YAML로 쓰고, 불러올 때 JSON으로 바꿔 둔다(prepare.ts) */
export const CHART_SCHEMAS = { bars: BarsSchema, hbars: HBarsSchema } as const

function chartData<T>(schema: z.ZodType<T>, json: string, where: string): T {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new DocError(
      where,
      '막대 블록을 읽을 수 없음 (불러오기 단계를 거치지 않음)',
    )
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success)
    throw new DocError(where, `막대 블록: ${parsed.error.message}`)
  return parsed.data
}

/** ```bars(세로 막대) / ```hbars(가로 막대) */
function chart(
  lang: string | null | undefined,
  json: string,
  where: string,
  key: number,
): ReactNode {
  if (lang === 'bars') return bars(chartData(BarsSchema, json, where), key)
  if (lang === 'hbars') {
    const { rows, label, max } = chartData(HBarsSchema, json, where)
    return <HBars key={key} rows={rows} label={label} max={max} />
  }
  throw new DocError(where, `쓸 수 없는 코드 블록: ${lang ?? '(이름 없음)'}`)
}

function bars(
  { label, bars: rows }: z.infer<typeof BarsSchema>,
  key: number,
): ReactNode {
  return (
    <div key={key}>
      <div className="bars" role="img" aria-label={label}>
        {rows.map((b, i) => (
          <div key={i} className={b.hot ? 'hot' : undefined}>
            {b.text}
            <i style={{ height: `${b.height}px` }}></i>
          </div>
        ))}
      </div>
      <p className="years">
        {rows.map((b, i) => (
          <span key={i}>{b.year}</span>
        ))}
      </p>
    </div>
  )
}

const TONES = ['ok', 'warn', 'bad', 'none']

function stateList(list: List, where: string): ReactNode {
  return (
    <ul className="state">
      {items(list, where).map((it, i) => {
        const nodes = only(it, where).children
        const tone = nodes.at(-1)
        if (tone?.type !== 'textDirective' || !TONES.includes(tone.name))
          throw new DocError(
            where,
            '항목 끝에 :ok[…] :warn[…] :bad[…] :none[…] 중 하나',
          )
        return (
          <li key={i}>
            <span>{renderInline(trimEnd(nodes.slice(0, -1)), where)}</span>
            <span className={`st ${tone.name}`}>
              {plain(tone.children, where)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function flowNode(item: ListItem, where: string, key: number): ReactNode {
  const l = requireLead(only(item, where), where)
  return (
    <div key={key} className="node">
      <b>{l.label}</b>
      <span>{renderInline(l.rest, where)}</span>
    </div>
  )
}

function withArrows(nodes: Array<ReactNode>): Array<ReactNode> {
  return nodes.flatMap((n, i) =>
    i === 0
      ? [n]
      : [
          <div key={`a${i}`} className="down">
            <DownArrow />
          </div>,
          n,
        ],
  )
}

/** 돈의 흐름: **이름** 설명 항목을 화살표로 잇는다. 하위 목록이 있는 항목은 묶음(zone) */
function flow(list: List, where: string): ReactNode {
  return (
    <div className="flow">
      {withArrows(
        items(list, where).map((it, i) => {
          const [p] = it.children
          const sub = it.children.at(1)
          if (sub?.type !== 'list' || it.children.length > 2)
            return flowNode(it, where, i)
          if (p.type !== 'paragraph')
            throw new DocError(where, '묶음 이름은 문단')
          return (
            <div key={i} className="zone">
              <span className="label">{renderInline(p.children, where)}</span>
              {withArrows(
                items(sub, where).map((s, j) => flowNode(s, where, j)),
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}

function figureDirective(d: ContainerDirective, where: string): ReactNode {
  const w = `${where} > :::${d.name}`
  const { attrs, body } = directive(d, w)
  switch (d.name) {
    case 'split': {
      const parts = items(single(body, 'list', w), w)
      if (parts.length !== 2) throw new DocError(w, '항목 두 개(앞 / 뒤)')
      if (!attrs.label)
        throw new DocError(w, ':::split{label="화면 낭독용 요약"}이 필요함')
      return (
        <div className="split" role="img" aria-label={attrs.label}>
          <span className="a">
            {renderInline(only(parts[0], w).children, w)}
          </span>
          <span className="b">
            {renderInline(only(parts[1], w).children, w)}
          </span>
        </div>
      )
    }
    case 'flow':
      return flow(single(body, 'list', w), w)
    case 'state':
      return stateList(single(body, 'list', w), w)
    default:
      throw new DocError(where, `그림에 쓸 수 없는 블록 :::${d.name}`)
  }
}

/** 축 카드의 그림: 소제목, 사실 목록, 설명, 막대, 흐름, 상태 목록 */
export function renderFigure(nodes: Blocks, where: string): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'heading':
        return (
          <h4 key={i} className="sub-h">
            {renderInline(n.children, where)}
          </h4>
        )
      case 'list':
        return (
          <ul key={i} className="f">
            {items(n, where).map((it, j) => (
              <li key={j}>{renderInline(only(it, where).children, where)}</li>
            ))}
          </ul>
        )
      case 'paragraph': {
        const l = lead(n, where)
        return l?.label === '시민 단위' ? (
          <p key={i} className="per">
            {renderInline(l.rest, where)}
          </p>
        ) : (
          <p key={i} className="cap">
            {renderInline(n.children, where)}
          </p>
        )
      }
      case 'code':
        return chart(n.lang, n.value, where, i)
      case 'containerDirective':
        return <Fragment key={i}>{figureDirective(n, where)}</Fragment>
      default:
        throw new DocError(where, `그림에 쓸 수 없는 블록: ${n.type}`)
    }
  })
}
