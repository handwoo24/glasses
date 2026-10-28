import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

const CiteContext = createContext<ReadonlyMap<string, number>>(new Map())

interface CiteProviderProps {
  sourceIds: ReadonlyArray<string>
  children: ReactNode
}

/** source id(s1…)를 화면 각주 번호(1…)로 바꿔 준다 */
export function CiteProvider({ sourceIds, children }: CiteProviderProps) {
  const map = useMemo(
    () => new Map(sourceIds.map((id, i) => [id, i + 1])),
    [sourceIds],
  )
  return <CiteContext.Provider value={map}>{children}</CiteContext.Provider>
}

interface CiteProps {
  ids?: ReadonlyArray<string>
}

/** 출처 번호. 출처 목록의 #src-<번호>로 간다 */
export function Cite({ ids = [] }: CiteProps) {
  const map = useContext(CiteContext)
  if (ids.length === 0) return null
  return (
    <sup className="cite">
      {/* 앞 글자와 출처 번호 사이에서 줄이 바뀌지 않게 (번호만 다음 줄로 떨어지지 않게) */}
      {'⁠'}
      {ids.map((id, i) => {
        const n = map.get(id)
        if (n === undefined)
          throw new Error(`없는 출처: ${id} (CiteProvider의 출처 목록에 없음)`)
        return (
          <span key={`${i}-${id}`}>
            {i > 0 && ','}
            <a href={`#src-${n}`} aria-label={`출처 ${n}`}>
              {n}
            </a>
          </span>
        )
      })}
    </sup>
  )
}
