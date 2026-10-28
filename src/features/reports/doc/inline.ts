// 문단 안의 글자를 읽는 도구: 출처 [s1], 첫머리 라벨(**라벨** / :req[라벨]).
import type { Cited } from '../assessment'
import { DocError } from './markdown'
import type { ListItem, Paragraph, PhrasingContent } from 'mdast'

/** 문장 끝 출처 묶음 [s1][s2] (앞 공백 포함) */
export const CITE_RUN = /\s*((?:\[s\d+\])+)/g
const ANY_CITE = /\[s\d+\]/
const TRAILING_CITES = /^([\s\S]*?)\s*((?:\[s\d+\])*)$/

export function citeIds(run: string): Array<string> {
  return [...run.matchAll(/\[(s\d+)\]/g)].map((m) => m[1])
}

/** 글자만 있는 내용을 그대로. 굵게·링크 등 꾸밈이 있으면 실패 */
export function rawText(
  nodes: ReadonlyArray<PhrasingContent>,
  where: string,
): string {
  return nodes
    .map((n) => {
      if (n.type !== 'text')
        throw new DocError(where, `글자만 쓸 수 있는 자리에 ${n.type}`)
      return n.value
    })
    .join('')
}

/** 출처를 달지 않는 글자 칸. [s1]이 있으면 화면에 글자로 보이므로 실패 */
export function plain(
  nodes: ReadonlyArray<PhrasingContent>,
  where: string,
): string {
  const text = rawText(nodes, where)
  if (ANY_CITE.test(text))
    throw new DocError(where, `출처를 붙일 수 없는 자리: ${text}`)
  return text
}

/** 출처가 문장 끝에만 붙은 글: [문장, ...출처] */
export function cited(
  nodes: ReadonlyArray<PhrasingContent>,
  where: string,
): Cited {
  const [, text, run] = TRAILING_CITES.exec(rawText(nodes, where)) ?? []
  if (ANY_CITE.test(text))
    throw new DocError(where, `출처는 문장 끝에만 붙인다: ${text}`)
  if (!text) throw new DocError(where, '내용이 비어 있음')
  return [text, ...citeIds(run)]
}

export interface Lead {
  label: string
  /** :req[라벨]처럼 지시자로 쓴 라벨의 이름 */
  variant?: string
  rest: Array<PhrasingContent>
}

/** 문단 첫머리 라벨. **라벨**, 또는 그 자리에 허용한 :이름[라벨] */
export function lead(
  p: Paragraph,
  where: string,
  variants: ReadonlyArray<string> = [],
): Lead | undefined {
  const first = p.children.at(0)
  const rest = p.children.slice(1)
  if (first?.type === 'strong') {
    return { label: plain(first.children, where), rest: trimStart(rest) }
  }
  if (first?.type === 'textDirective' && variants.includes(first.name)) {
    return {
      label: plain(first.children, where),
      variant: first.name,
      rest: trimStart(rest),
    }
  }
  return undefined
}

/** **라벨** 로 시작하는 문단의 나머지 글자. 라벨이 다르거나 문단이 없으면 실패 */
export function labelledText(
  p: Paragraph | undefined,
  label: string,
  where: string,
): string {
  const l = p && lead(p, where)
  if (l?.label !== label)
    throw new DocError(where, `**${label}** 로 시작하는 문단이 필요함`)
  return plain(l.rest, where)
}

export function requireLead(
  p: Paragraph,
  where: string,
  variants: ReadonlyArray<string> = [],
): Lead {
  const found = lead(p, where, variants)
  if (!found) throw new DocError(where, '문단 첫머리에 **라벨**이 있어야 함')
  return found
}

function trimStart(
  nodes: ReadonlyArray<PhrasingContent>,
): Array<PhrasingContent> {
  const first = nodes.at(0)
  const rest = nodes.slice(1)
  if (first?.type !== 'text') return [...nodes]
  const value = first.value.replace(/^\s+/, '')
  return value ? [{ ...first, value }, ...rest] : rest
}

export function trimEnd(
  nodes: ReadonlyArray<PhrasingContent>,
): Array<PhrasingContent> {
  const last = nodes.at(-1)
  if (last?.type !== 'text') return [...nodes]
  const value = last.value.replace(/\s+$/, '')
  const head = nodes.slice(0, -1)
  return value ? [...head, { ...last, value }] : head
}

/** 목록 항목의 문단들. 비었거나 문단이 아닌 것이 섞이면 실패 */
export function itemParagraphs(
  item: ListItem,
  where: string,
): Array<Paragraph> {
  if (item.children.length === 0) throw new DocError(where, '빈 항목')
  return item.children.map((c) => {
    if (c.type !== 'paragraph')
      throw new DocError(where, `목록 항목 안에 ${c.type}는 쓸 수 없음`)
    return c
  })
}
