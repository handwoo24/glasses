// 본문 트리를 브라우저로 보낼 모양으로 다듬는다(서버에서만): 막대 블록 YAML → JSON, 원문 위치 정보 제거.
import { parse as parseYaml } from 'yaml'
import { DocError } from './errors'
import { CHART_SCHEMAS } from './rich'
import type { Node } from 'mdast'

function chartJson(lang: string, yaml: string, where: string): string {
  const schema = CHART_SCHEMAS[lang as keyof typeof CHART_SCHEMAS]
  let value: unknown
  try {
    value = parseYaml(yaml)
  } catch (e) {
    throw new DocError(where, `${lang} 블록의 YAML: ${(e as Error).message}`)
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success)
    throw new DocError(where, `${lang} 블록: ${parsed.error.message}`)
  return JSON.stringify(parsed.data)
}

/** 위치 정보(position)를 뺀 새 트리. 막대 블록은 검사한 JSON으로 바꾼다 */
export function prepare<T extends Node>(node: T, where: string): T {
  const { position: _position, ...rest } = node as T & {
    children?: Array<Node>
  }
  if (
    rest.type === 'code' &&
    'lang' in rest &&
    typeof rest.lang === 'string' &&
    rest.lang in CHART_SCHEMAS &&
    'value' in rest
  ) {
    return {
      ...rest,
      value: chartJson(rest.lang, String(rest.value), where),
    } as T
  }
  if (Array.isArray(rest.children))
    return {
      ...rest,
      children: rest.children.map((c) => prepare(c, where)),
    } as T
  return rest as T
}

export function prepareAll<T extends Node>(
  nodes: ReadonlyArray<T>,
  where: string,
): Array<T> {
  return nodes.map((n) => prepare(n, where))
}
