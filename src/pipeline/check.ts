// 사실 원장의 결정론적 검사: 자료 파일 해시가 기록과 같은지, 인용이 원문에 글자 그대로 있는지.
// 판단이 필요 없는 검사는 검증 에이전트에 맡기지 않고 여기서 한다.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { FactSchema, MaterialSchema } from './schemas'
import type { Fact } from './schemas'
import { get, list } from './store'

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
    const bytes = readFileSync(material.file)
    const sha = createHash('sha256').update(bytes).digest('hex')
    if (sha !== material.sha256)
      return [{ fact: id, problem: `자료 파일이 바뀜: ${material.file}` }]
    files.set(material.file, bytes.toString('utf8'))
  }
  const text = files.get(material.file) ?? ''
  return fact.quote && text.includes(fact.quote)
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
