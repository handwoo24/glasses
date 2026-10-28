// 리포트 문서(.md)를 머리말(YAML)과 마크다운 트리로 나눈다.
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { parse as parseYaml } from 'yaml'
import type { Parent, Root, RootContent } from 'mdast'

/** 본문에서 쓰는 글자 지시자(:이름[글자]) */
export const TEXT_DIRECTIVES = [
  'grp',
  'night',
  'req',
  'ok',
  'warn',
  'bad',
  'none',
] as const

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

export class DocError extends Error {
  constructor(where: string, message: string) {
    super(`[${where}] ${message}`)
    this.name = 'DocError'
  }
}

export function parseMarkdown(src: string): { front: unknown; root: Root } {
  const m = FRONT.exec(src)
  if (!m)
    throw new DocError('머리말', '문서 첫 줄은 --- 로 시작하는 머리말이어야 함')
  const root = unified()
    .use(remarkParse)
    // 한 개짜리 ~ 는 취소선이 아니라 범위(2023~2026년)로 쓴다
    .use(remarkGfm, { singleTilde: false })
    .use(remarkDirective)
    .parse(src.slice(m[0].length))
  return { front: parseYaml(m[1]), root: restoreStrayDirectives(root) }
}

function isStray(node: RootContent): boolean {
  return (
    node.type === 'textDirective' &&
    !(TEXT_DIRECTIVES as ReadonlyArray<string>).includes(node.name) &&
    node.children.length === 0 &&
    Object.keys(node.attributes ?? {}).length === 0
  )
}

/**
 * 10:00 의 :00 처럼 지시자로 읽힌 글자를 되돌린 새 트리를 돌려준다.
 * 정한 이름이 아니고 [글자]나 {속성}도 없는 것만 되돌리고, 나머지는 렌더링에서 오류가 난다.
 */
function restoreStrayDirectives<T extends Parent>(node: T): T {
  const children = node.children.reduce<Array<RootContent>>((out, child) => {
    const next: RootContent =
      child.type === 'textDirective' && isStray(child)
        ? { type: 'text', value: `:${child.name}` }
        : 'children' in child
          ? restoreStrayDirectives(child)
          : child
    const prev = out.at(-1)
    return next.type === 'text' && prev?.type === 'text'
      ? [...out.slice(0, -1), { ...prev, value: prev.value + next.value }]
      : [...out, next]
  }, [])
  return { ...node, children }
}
