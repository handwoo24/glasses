import { formatKrwThousand, formatNumber } from '../format'

export type ChartUnit = 'krw-thousand' | 'krw' | 'count' | 'percent'

const TEN_EOK_IN_THOUSAND = 1_000_000

/** 축 눈금처럼 짧게 써야 할 때. 10억 원 이상은 억 원, 그 아래는 만 원까지 */
export function formatShort(v: number, unit: ChartUnit): string {
  if (unit === 'krw-thousand' || unit === 'krw') {
    const thousand = unit === 'krw' ? v / 1000 : v
    const precision = Math.abs(thousand) >= TEN_EOK_IN_THOUSAND ? '억' : '만'
    return formatKrwThousand(thousand, { precision })
  }
  if (unit === 'percent') return `${formatNumber(Math.round(v * 10) / 10)}%`
  return formatNumber(v)
}

/** 툴팁·표처럼 정확히 보여 줄 때 (만 원 단위) */
export function formatFull(v: number, unit: ChartUnit, signed = false): string {
  if (unit === 'krw-thousand') return formatKrwThousand(v, { signed })
  if (unit === 'krw') return formatKrwThousand(v / 1000, { signed })
  if (unit === 'percent')
    return `${formatNumber(Math.round(v * 10) / 10, signed)}%`
  return formatNumber(v, signed)
}
