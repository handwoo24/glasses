import { useEffect } from 'react'

/** 주소의 #id가 접힌 상자 안을 가리키면 그 상자(와 바깥 상자)를 열고 스크롤한다 */
export function useOpenDetailsOnHash() {
  useEffect(() => {
    const open = () => {
      const raw = window.location.hash.slice(1)
      if (!raw) return
      const target =
        document.getElementById(raw) ?? document.getElementById(safeDecode(raw))
      if (!target) return
      if (target instanceof HTMLDetailsElement) target.open = true
      let el = target.parentElement?.closest('details') ?? null
      while (el) {
        el.open = true
        el = el.parentElement?.closest('details') ?? null
      }
      target.scrollIntoView()
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
