import { GLOSSARY } from '#/content/glossary'

export function GlossaryList({ terms }: { terms: ReadonlyArray<string> }) {
  const known = terms.filter((t) => t in GLOSSARY)
  if (known.length === 0) return null
  return (
    <dl className="m-0 grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {known.map((t) => (
        <div key={t}>
          <dt className="font-serif text-[15px] font-bold">{t}</dt>
          <dd className="m-0 mt-1 text-[14px] leading-relaxed text-ink-soft">
            {GLOSSARY[t]}
          </dd>
        </div>
      ))}
    </dl>
  )
}
