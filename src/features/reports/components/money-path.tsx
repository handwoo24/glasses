import type { MoneyPath } from '../schema'
import { Cite } from './cite'

/** 돈이 지나간 길을 위에서 아래로: 각 단계는 상자, 사이는 화살표 */
export function MoneyPathView({ path }: { path: MoneyPath }) {
  return (
    <figure className="m-0">
      <figcaption className="mb-4">
        <span className="block font-serif text-[1.05rem] font-bold">
          {path.title}
        </span>
        {path.caption && (
          <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
            {path.caption}
          </span>
        )}
      </figcaption>
      <ol className="m-0 list-none p-0">
        {path.nodes.map((n, i) => (
          <li key={`${i}-${n.label}`}>
            {i > 0 && (
              <span aria-hidden className="ml-6 block h-6 w-px bg-ink" />
            )}
            <div className="grid gap-x-4 gap-y-1 border border-ink bg-sheet px-4 py-3 sm:grid-cols-[13rem_1fr]">
              <p className="m-0">
                <span className="block text-[15px] font-semibold">
                  {n.label}
                </span>
                {n.amount && (
                  <span className="mt-0.5 block font-serif text-[1.15rem] font-bold text-accent">
                    {n.amount}
                  </span>
                )}
              </p>
              <p className="m-0 text-[14px] leading-[1.75] text-ink-soft">
                {n.detail}
                <Cite ids={n.cite} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}
