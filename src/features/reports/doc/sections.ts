// 제목(##, ###, ####)으로 문서를 구역으로 나눈다.
import type { ZodType } from 'zod'
import { rawText } from './inline'
import { DocError } from './markdown'
import type { Heading, RootContent } from 'mdast'

export interface Section {
  /** 제목 글자 ({#id} 표시는 뺀다) */
  title: string
  /** 제목 끝 {#id} 표시: 제목이 문서마다 다른 구역(이용 안내 {#side} 등) */
  id?: string
  heading: Heading
  nodes: Array<RootContent>
  where: string
}

const ID_MARK = /\s*\{#([a-z]+)\}$/

export function splitSections(
  nodes: ReadonlyArray<RootContent>,
  depth: 2 | 3 | 4,
  where: string,
): { before: Array<RootContent>; sections: Array<Section> } {
  const before: Array<RootContent> = []
  const sections: Array<Section> = []
  for (const n of nodes) {
    if (n.type === 'heading' && n.depth < depth)
      throw new DocError(
        where,
        `${'#'.repeat(n.depth)} 제목이 이 자리에 올 수 없음`,
      )
    if (n.type === 'heading' && n.depth === depth) {
      // 제목은 글자만. 출처 [s1]은 쓰는 쪽(계약명 등)이 heading에서 다시 읽는다
      const text = rawText(n.children, where)
      // {#id}는 ## 구역에만 쓴다. 더 깊은 제목에서는 글자로 남아 이름 확인에서 걸린다
      const id = depth === 2 ? ID_MARK.exec(text)?.[1] : undefined
      const title = id ? text.replace(ID_MARK, '') : text
      sections.push({
        title,
        id,
        heading: n,
        nodes: [],
        where: `${where} > ${title}`,
      })
    } else if (sections.length) {
      sections[sections.length - 1].nodes.push(n)
    } else {
      before.push(n)
    }
  }
  return { before, sections }
}

/** 이름으로 하위 구역을 찾는다. 없는 이름의 구역이 있으면 실패 */
export function namedSections(
  sections: ReadonlyArray<Section>,
  allowed: ReadonlyArray<string>,
  where: string,
): Map<string, Section> {
  const out = new Map<string, Section>()
  for (const s of sections) {
    if (!allowed.includes(s.title))
      throw new DocError(
        where,
        `알 수 없는 구역 "${s.title}" (쓸 수 있는 것: ${allowed.join(', ')})`,
      )
    if (out.has(s.title))
      throw new DocError(where, `구역 "${s.title}"이 두 번 나옴`)
    out.set(s.title, s)
  }
  return out
}

/** 블록이 정한 종류·순서인지 확인하고 순서대로 돌려준다 */
export function expectNodes<const T extends ReadonlyArray<RootContent['type']>>(
  nodes: ReadonlyArray<RootContent>,
  types: T,
  where: string,
): { [K in keyof T]: Extract<RootContent, { type: T[K] }> } {
  const got = nodes.map((n) => n.type)
  if (got.length !== types.length || got.some((t, i) => t !== types[i]))
    throw new DocError(
      where,
      `${types.join(', ') || '(아무것도 없음)'} 순서여야 함 (지금: ${got.join(', ') || '없음'})`,
    )
  return nodes as unknown as {
    [K in keyof T]: Extract<RootContent, { type: T[K] }>
  }
}

/** zod 검증 실패를 문서 위치와 함께 알린다 */
export function check<T>(schema: ZodType<T>, value: unknown, where: string): T {
  const r = schema.safeParse(value)
  if (!r.success) {
    const msg = r.error.issues
      .map((i) => `${i.path.join('.') || '(값)'}: ${i.message}`)
      .join('; ')
    throw new DocError(where, msg)
  }
  return r.data
}
