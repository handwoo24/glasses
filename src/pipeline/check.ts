// 사실 원장의 결정론적 검사: 자료 파일 해시가 기록과 같은지, 인용이 원문에 글자 그대로 있는지.
// 판단이 필요 없는 검사는 검증 에이전트에 맡기지 않고 여기서 한다.
import { createHash } from 'node:crypto'
import { FactSchema, MaterialSchema, NAME_MASK } from './schemas'
import type { Fact } from './schemas'
import { get, list, readMaterialFile } from './store'

const squash = (s: string) => s.replace(/\s+/g, ' ')

/**
 * 인용이 원문에 있는지. 공백·줄바꿈의 차이는 보지 않고(회의록은 발언마다 줄을 바꾼다) 글자는 그대로 맞춘다.
 * 가린 이름(○○○)은 원문의 아무 이름(한글 2~4자)과 맞춘다.
 */
export function quoteMatches(text: string, quote: string): boolean {
  const body = squash(text)
  const q = squash(quote).trim()
  if (!q.includes(NAME_MASK)) return body.includes(q)
  const pattern = q
    .split(NAME_MASK)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[가-힣]{2,4}')
  return new RegExp(pattern).test(body)
}

export interface FactProblem {
  fact: string
  problem: string
}

async function checkSourced(
  id: string,
  fact: Fact,
  files: Map<string, string>,
): Promise<Array<FactProblem>> {
  const material = MaterialSchema.parse(await get(`materials/${fact.material}`))
  if (!files.has(material.file)) {
    const bytes = await readMaterialFile(material.file)
    const sha = createHash('sha256').update(bytes).digest('hex')
    if (sha !== material.sha256)
      return [{ fact: id, problem: `자료 파일이 바뀜: ${material.file}` }]
    files.set(material.file, bytes.toString('utf8'))
  }
  const text = files.get(material.file) ?? ''
  return fact.quote && quoteMatches(text, fact.quote)
    ? []
    : [{ fact: id, problem: `인용이 원문에 없음: ${fact.quote}` }]
}

/** 사업의 사실 원장 전체를 검사한다. 문제가 없으면 빈 배열 */
export async function checkFacts(program: string): Promise<Array<FactProblem>> {
  const rows = await list(`programs/${program}/facts`)
  const ids = new Set(rows.map((r) => r.id))
  const files = new Map<string, string>()
  const problems: Array<FactProblem> = []
  for (const { id, data } of rows) {
    const fact = FactSchema.parse(data)
    if (fact.material) problems.push(...(await checkSourced(id, fact, files)))
    for (const ref of fact.derivedFrom ?? [])
      if (!ids.has(ref))
        problems.push({ fact: id, problem: `근거 사실이 없음: ${ref}` })
  }
  return problems
}
