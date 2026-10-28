import { formatDate } from '../format'
import type { Source } from '../schema'

interface SourceListProps {
  sources: ReadonlyArray<Source>
}

export function SourceList({ sources }: SourceListProps) {
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {sources.map((s, i) => (
        <li
          key={s.id}
          id={`source-${s.id}`}
          className="grid scroll-mt-24 grid-cols-[2rem_1fr] text-[14px] leading-relaxed target:bg-accent/10"
        >
          <span className="font-semibold text-accent">[{i + 1}]</span>
          <span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline decoration-rule underline-offset-[3px] hover:decoration-ink"
            >
              {s.title}
            </a>
            <span className="block text-[13px] text-muted">
              {s.org} · {s.kind} · {formatDate(s.date)}
              {s.locator && <> · {s.locator}</>}
            </span>
            <span className="block text-[12px] text-muted">{s.license}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
