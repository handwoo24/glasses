const nf = new Intl.NumberFormat('ko-KR')

/**
 * 천원 단위 금액을 한국어 표기로 바꾼다.
 * precision '만': 3조 7,629억 7,137만 원 / '억': 3조 7,630억 원
 */
export function formatKrwThousand(
  thousand: number,
  {
    precision = '만',
    signed = false,
  }: { precision?: '만' | '억'; signed?: boolean } = {},
): string {
  const sign = thousand < 0 ? '−' : signed && thousand > 0 ? '+' : ''
  const step = precision === '억' ? 100_000 : 10 // 천원 → 억 / 만
  const units = Math.round(Math.abs(thousand) / step)
  if (units === 0) return `${sign}0원`

  const parts: Array<string> = []
  if (precision === '억') {
    const jo = Math.floor(units / 10_000)
    const eok = units % 10_000
    if (jo) parts.push(`${nf.format(jo)}조`)
    if (eok) parts.push(`${nf.format(eok)}억`)
  } else {
    const jo = Math.floor(units / 100_000_000)
    const eok = Math.floor(units / 10_000) % 10_000
    const man = units % 10_000
    if (jo) parts.push(`${nf.format(jo)}조`)
    if (eok) parts.push(`${nf.format(eok)}억`)
    if (man) parts.push(`${nf.format(man)}만`)
  }
  return `${sign}${parts.join(' ')} 원`
}

export function formatNumber(n: number, signed = false): string {
  const s = nf.format(Math.abs(n))
  if (n < 0) return `−${s}`
  return signed && n > 0 ? `+${s}` : s
}

/** 2026-10-20 → 2026. 10. 20. / 2026-10 → 2026. 10. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d ? `${y}. ${Number(m)}. ${Number(d)}.` : `${y}. ${Number(m)}.`
}

/** 원 단위 금액 → 10억 6,168만 원 (만 원 아래는 반올림) */
export function formatWon(won: number): string {
  const eok = Math.floor(won / 1e8)
  const man = Math.round((won % 1e8) / 1e4)
  if (eok && man) return `${nf.format(eok)}억 ${nf.format(man)}만 원`
  if (eok) return `${nf.format(eok)}억 원`
  return `${nf.format(man)}만 원`
}
