import { formatKrwThousand } from '../format'
import type { MoneyFlow } from '../schema'
import { Cite } from './cite'

interface Row {
  label: string
  from: number
  to: number
  kind: 'total' | 'up' | 'down'
  cite: ReadonlyArray<string>
}

function toRows(flow: MoneyFlow): Array<Row> {
  const rows: Array<Row> = [
    {
      label: flow.start.label,
      from: 0,
      to: flow.start.amount,
      kind: 'total',
      cite: flow.start.cite,
    },
  ]
  let running = flow.start.amount
  for (const s of flow.steps) {
    rows.push({
      label: s.label,
      from: running,
      to: running + s.delta,
      kind: s.delta >= 0 ? 'up' : 'down',
      cite: s.cite,
    })
    running += s.delta
  }
  rows.push({
    label: flow.end.label,
    from: 0,
    to: flow.end.amount,
    kind: 'total',
    cite: flow.end.cite,
  })
  return rows
}

/** 변화폭이 전체의 30% 미만이면 축을 0이 아닌 곳에서 시작해야 증감이 보인다 */
function domain(rows: ReadonlyArray<Row>): {
  lo: number
  hi: number
  truncated: boolean
} {
  const levels = rows.flatMap((r) =>
    r.kind === 'total' ? [r.to] : [r.from, r.to],
  )
  const min = Math.min(...levels)
  const max = Math.max(...levels)
  if (min <= 0 || (max - min) / max >= 0.3)
    return { lo: 0, hi: max * 1.02, truncated: false }
  const span = max - min
  return { lo: min - span * 0.6, hi: max + span * 0.08, truncated: true }
}

const BAR = { total: 'bg-total', up: 'bg-up', down: 'bg-down' } as const
const TEXT = { total: 'text-ink', up: 'text-up', down: 'text-down' } as const

interface WaterfallProps {
  flow: MoneyFlow
}

export function Waterfall({ flow }: WaterfallProps) {
  const rows = toRows(flow)
  const { lo, hi, truncated } = domain(rows)
  const pct = (v: number) => ((Math.max(v, lo) - lo) / (hi - lo)) * 100

  return (
    <figure className="m-0">
      <figcaption className="mb-4 text-[15px] font-semibold text-ink">
        {flow.title}
      </figcaption>
      <ol className="m-0 list-none p-0">
        {rows.map((r, i) => {
          const left = r.kind === 'total' ? 0 : pct(Math.min(r.from, r.to))
          const width = Math.max(pct(Math.max(r.from, r.to)) - left, 0.6)
          const value =
            r.kind === 'total'
              ? formatKrwThousand(r.to)
              : formatKrwThousand(r.to - r.from, { signed: true })
          return (
            <li
              key={`${r.label}-${i}`}
              className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-rule py-2.5 sm:grid-cols-[8.5rem_1fr_11rem] sm:items-center"
            >
              <span
                className={`text-[14px] ${r.kind === 'total' ? 'font-semibold' : ''}`}
              >
                {r.label}
                <Cite ids={r.cite} />
              </span>
              <span
                className={`text-right text-[14px] font-semibold sm:order-last ${TEXT[r.kind]}`}
              >
                {value}
              </span>
              <span
                className="relative col-span-2 mt-1.5 h-3.5 sm:col-span-1 sm:mt-0"
                aria-hidden
              >
                <span
                  className={`absolute inset-y-0 rounded-[2px] ${BAR[r.kind]}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </span>
            </li>
          )
        })}
      </ol>
      {truncated && (
        <p className="mt-2 text-[12px] text-muted">
          막대의 왼쪽 끝은 0원이 아니라{' '}
          {formatKrwThousand(lo, { precision: '억' })}부터 시작한다. 증감을
          보이게 하려고 축을 잘랐다.
        </p>
      )}
    </figure>
  )
}
