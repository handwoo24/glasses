import type { ReactNode } from 'react'
import { Cite } from '../components/cite'

export interface TableColumn {
  label: string
  align?: 'left' | 'right'
}

interface ChartFrameProps {
  title: string
  caption?: string
  cite: ReadonlyArray<string>
  legend?: ReactNode
  columns: ReadonlyArray<TableColumn>
  rows: ReadonlyArray<ReadonlyArray<string>>
  children: ReactNode
}

/** 차트 공통 틀: 제목, 범례, 출처, 그리고 같은 숫자를 표로 보는 대체 수단 */
export function ChartFrame({
  title,
  caption,
  cite,
  legend,
  columns,
  rows,
  children,
}: ChartFrameProps) {
  return (
    <figure className="m-0 border-t border-ink pt-4">
      <figcaption className="mb-3">
        <span className="block text-[15px] font-semibold text-ink">
          {title}
          <Cite ids={cite} />
        </span>
        {caption && (
          <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">
            {caption}
          </span>
        )}
      </figcaption>
      {legend}
      <div aria-hidden>{children}</div>
      <details className="mt-2 text-[13px]">
        <summary className="cursor-pointer text-muted hover:text-ink">
          표로 보기
        </summary>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink">
              {columns.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  className={`py-1.5 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-rule">
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`py-1.5 ${columns[j]?.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

interface LegendItem {
  label: string
  color: string
}

export function Legend({ items }: { items: ReadonlyArray<LegendItem> }) {
  return (
    <ul className="m-0 mb-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-ink-soft">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-[2px]"
            style={{ background: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipBoxProps {
  title: string
  lines: ReadonlyArray<{ label: string; value: string; color?: string }>
}

export function TooltipBox({ title, lines }: TooltipBoxProps) {
  return (
    <div className="rounded-[4px] border border-rule bg-sheet px-3 py-2 text-[12.5px] shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
      <p className="m-0 mb-1 font-semibold text-ink">{title}</p>
      {lines.map((l) => (
        <p
          key={l.label}
          className="m-0 flex items-center gap-1.5 text-ink-soft"
        >
          {l.color && (
            <span
              aria-hidden
              className="inline-block size-2 rounded-[2px]"
              style={{ background: l.color }}
            />
          )}
          <span>{l.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
            {l.value}
          </span>
        </p>
      ))}
    </div>
  )
}
