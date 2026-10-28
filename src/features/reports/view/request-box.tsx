import { useId, useRef, useState } from 'react'

/** 정보공개청구 문구와 복사 버튼. 클립보드가 막히면 글자를 선택해 둔다 */
export function RequestBox({ text }: { text: string }) {
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  const [status, setStatus] = useState('')

  const fallback = () => {
    box.current?.focus()
    box.current?.select()
    setStatus('선택해 두었습니다. 직접 복사해 주세요')
  }

  const copy = () => {
    setStatus('')
    // 오래된 브라우저나 앱 안 보기 화면은 clipboard가 없거나 거부한다
    try {
      navigator.clipboard
        .writeText(text)
        .then(() => setStatus('복사했습니다'), fallback)
    } catch {
      fallback()
    }
  }

  return (
    <div className="copy">
      <textarea
        id={id}
        ref={box}
        readOnly
        aria-label="청구 문구"
        value={text}
      />
      <div className="copy-row">
        <span role="status">{status}</span>
        <button type="button" onClick={copy}>
          문구 복사
        </button>
      </div>
    </div>
  )
}
