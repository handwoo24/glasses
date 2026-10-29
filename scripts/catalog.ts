// 기관 사업 목록화 도구. 지방재정365 세부사업 JSON과 예산서 PDF로 사업 후보 목록을 만든다.
// 절차와 판단 기준은 .claude/skills/list-programs/SKILL.md. 예:
//   npm run catalog -- pdf-text .storage/materials/m-…/original.pdf /tmp/main.txt
//   npm run catalog -- candidates --lines .storage/materials/m-…/original.json --book /tmp/main.txt --book /tmp/supp3.txt --out /tmp/candidates.json
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import {
  despace,
  findInBook,
  isAdminLine,
  kindOf,
  nameKey,
  parseBudgetBook,
} from '#/pipeline/catalog/budget-book'
import type { BookLine } from '#/pipeline/catalog/budget-book'

const USAGE = `사용법: npm run catalog -- <명령>
  pdf-text <예산서.pdf> <출력.txt>             쪽마다 "=== page N ===" 를 붙인 텍스트
  candidates --lines <지방재정365.json> --book <예산서.txt> [--book …] --out <후보.json>
                                              세부사업에 부서·정책·단위를 붙이고, 행정경비를 빼고, 같은 이름을 합친다`

/** 지방재정365 세부사업별 세출현황 응답 한 줄 (retvLstExcDtlsBybsnAneSitu.do) */
const LofinRowSchema = z.object({
  code: z.string(),
  codeNm3: z.string(),
  codeNm4: z.string(),
  codeNm5: z.string(),
  codeNm6: z.string(),
  amt1: z.number(),
  amt2: z.number(),
  amt3: z.number(),
  amt4: z.number(),
  amt5: z.number(),
  amt6: z.number(),
})
const LofinSchema = z.object({ excExeInqRsltDto: z.array(LofinRowSchema) })

const decode = (s: string) =>
  s
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .trim()

async function pdfText(input: string, output: string) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(input)),
    useSystemFonts: true,
    verbosity: 0,
  }).promise
  const pages: Array<string> = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const { items } = await page.getTextContent()
    // 같은 높이(±2)의 조각을 한 줄로, 줄은 위에서 아래로
    const lines: Array<{ y: number; parts: Array<{ x: number; s: string }> }> =
      []
    for (const it of items) {
      if (!('str' in it) || !it.str.trim()) continue
      const y = Math.round(it.transform[5])
      const line = lines.find((l) => Math.abs(l.y - y) <= 2)
      const part = { x: it.transform[4], s: it.str }
      if (line) line.parts.push(part)
      else lines.push({ y, parts: [part] })
    }
    const text = lines
      .sort((a, b) => b.y - a.y)
      .map((l) =>
        l.parts
          .sort((a, b) => a.x - b.x)
          .map((t) => t.s)
          .join(' '),
      )
      .join('\n')
    pages.push(`=== page ${p} ===\n${text}`)
    page.cleanup()
  }
  writeFileSync(output, pages.join('\n\n'))
  process.stdout.write(`${doc.numPages}쪽 → ${output}\n`)
}

interface Candidate {
  name: string
  codes: Array<string>
  departments: Array<string>
  policy?: string
  unit?: string
  account: string
  sector: string
  subsector: string
  kind: string
  /** 원. 지방재정365 예산현액·국비·시도비·시군구비+기타·지출액 */
  amount: number
  national: number
  provincial: number
  local: number
  spent: number
  /** 예산서에서 찾은 방법 (없으면 찾지 못함) */
  matched: 'exact' | 'loose' | 'prefix' | null
}

/** 산출 내역 금액이 단위 자리에 끼어든 것(‘시)9,540,800,000원’)은 버린다 */
const cleanUnit = (u: string | undefined) =>
  u && !/\d원|\d,\d|^[가-힣]?\)/.test(u) ? u : undefined

function candidates(
  linesFile: string,
  books: ReadonlyArray<string>,
  out: string,
) {
  const rows = LofinSchema.parse(
    JSON.parse(readFileSync(linesFile, 'utf8')),
  ).excExeInqRsltDto
  const book: Array<BookLine> = books.flatMap((b) =>
    parseBudgetBook(readFileSync(b, 'utf8')),
  )
  const groups = new Map<string, Candidate>()
  let admin = 0
  let adminAmount = 0
  for (const r of rows) {
    const name = decode(r.codeNm4)
    const hit = findInBook(name, book)
    const first = hit?.lines[0]
    if (isAdminLine(name, first?.policy)) {
      admin++
      adminAmount += r.amt1
      continue
    }
    const key = nameKey(name)
    const prev = groups.get(key)
    const depts = [
      ...new Set(hit?.lines.map((l) => l.dept).filter(Boolean) ?? []),
    ]
    groups.set(key, {
      name,
      codes: [...(prev?.codes ?? []), r.code],
      departments: [...new Set([...(prev?.departments ?? []), ...depts])],
      policy: prev?.policy ?? first?.policy?.replace(/\([^()]*\/[^()]*\)$/, ''),
      unit: prev?.unit ?? cleanUnit(first?.unit),
      account:
        prev && !prev.account.includes(r.codeNm3)
          ? `${prev.account}, ${r.codeNm3}`
          : (prev?.account ?? r.codeNm3),
      sector: r.codeNm5,
      subsector: r.codeNm6,
      kind: kindOf(name),
      amount: (prev?.amount ?? 0) + r.amt1,
      national: (prev?.national ?? 0) + r.amt2,
      provincial: (prev?.provincial ?? 0) + r.amt3,
      local: (prev?.local ?? 0) + r.amt4 + r.amt5,
      spent: (prev?.spent ?? 0) + r.amt6,
      matched: prev?.matched ?? hit?.how ?? null,
    })
  }
  const list = [...groups.values()].sort((a, b) => b.amount - a.amount)
  writeFileSync(out, JSON.stringify(list, null, 1))
  const unmatched = list.filter((c) => !c.matched).length
  const eok = (v: number) => `${Math.round(v / 1e8).toLocaleString()}억`
  process.stdout.write(
    [
      `세부사업 ${rows.length}건 → 행정경비·재무 ${admin}건(${eok(adminAmount)}) 제외 → 사업 후보 ${list.length}개 (${eok(list.reduce((s, c) => s + c.amount, 0))})`,
      `예산서에서 부서를 찾지 못한 후보 ${unmatched}개 (이월·추경 신규·기금이 대부분)`,
      `예산서 세부사업 줄 ${book.length}개, 부서 ${new Set(book.map((b) => despace(b.dept))).size}곳`,
      `→ ${out}`,
    ].join('\n') + '\n',
  )
}

function option(args: ReadonlyArray<string>, name: string): Array<string> {
  return args.flatMap((a, i) =>
    a === `--${name}` && args[i + 1] ? [args[i + 1]] : [],
  )
}

async function main(args: ReadonlyArray<string>) {
  const [cmd, ...rest] = args
  if (cmd === 'pdf-text' && rest.length === 2) return pdfText(rest[0], rest[1])
  if (cmd === 'candidates') {
    const [lines] = option(rest, 'lines')
    const [out] = option(rest, 'out')
    const books = option(rest, 'book')
    if (lines && out && books.length) return candidates(lines, books, out)
  }
  process.stderr.write(`${USAGE}\n`)
  process.exitCode = 1
}

main(process.argv.slice(2)).catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exitCode = 1
})
