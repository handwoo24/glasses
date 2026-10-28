import { formatDate } from '../format'
import type { Report } from '../schema'
import { Cite } from './cite'

interface TimelineProps {
  items: Report['timeline']
  today: string
}

export function Timeline({ items, today }: TimelineProps) {
  return (
    <ol className="relative m-0 list-none border-l border-ink-soft p-0 pl-6">
      {items.map((t) => {
        const upcoming = t.date > today
        return (
          <li key={`${t.date}-${t.label}`} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[29.5px] top-[7px] size-2.5 rounded-full border-2 border-ink-soft ${upcoming ? 'bg-paper' : 'bg-ink-soft'}`}
            />
            <time
              dateTime={t.date}
              className="block text-[13px] font-semibold text-muted"
            >
              {formatDate(t.date)}
              {upcoming && <span className="ml-2 font-normal">예정</span>}
            </time>
            <p className="m-0 mt-0.5 text-[15px] leading-relaxed">
              {t.label}
              <Cite ids={t.cite} />
            </p>
          </li>
        )
      })}
    </ol>
  )
}
