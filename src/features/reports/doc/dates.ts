// 다음 판단 시점 라벨(‘11. 10.’ ‘12월’ ‘2027년 상반기’)을 정렬하고 D-day를 셀 수 있는 날짜로.
// 리포트에는 사람이 읽는 라벨을 그대로 쓰고, 연도가 없으면 기준일 뒤로 처음 오는 해로 본다.

const pad = (n: number) => String(n).padStart(2, '0')

function validMonth(m: number): boolean {
  return m >= 1 && m <= 12
}

/**
 * 판단 시점 라벨의 시작 날짜. 날까지 알면 YYYY-MM-DD, 달까지만 알면 YYYY-MM, 모르면 없음.
 * 범위(‘11. 10.~12. 10.’)는 시작 날짜를 쓴다.
 */
export function judgeDateStart(
  label: string,
  asOf: string,
): string | undefined {
  const baseYear = Number(asOf.slice(0, 4))
  const baseMonth = Number(asOf.slice(5, 7))
  const yearOf = (m: number) => (m < baseMonth ? baseYear + 1 : baseYear)
  const t = label.trim()

  const full = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./.exec(t)
  if (full) {
    const m = Number(full[2])
    return validMonth(m)
      ? `${full[1]}-${pad(m)}-${pad(Number(full[3]))}`
      : undefined
  }
  const half = /^(\d{4})년\s*(상|하)반기/.exec(t)
  if (half) return `${half[1]}-${half[2] === '상' ? '01' : '07'}`
  const yearMonth = /^(\d{4})년\s*(\d{1,2})월/.exec(t)
  if (yearMonth) {
    const m = Number(yearMonth[2])
    return validMonth(m) ? `${yearMonth[1]}-${pad(m)}` : undefined
  }
  const day = /^(\d{1,2})\.\s*(\d{1,2})\./.exec(t)
  if (day) {
    const m = Number(day[1])
    return validMonth(m)
      ? `${yearOf(m)}-${pad(m)}-${pad(Number(day[2]))}`
      : undefined
  }
  const month = /^(\d{1,2})월/.exec(t)
  if (month) {
    const m = Number(month[1])
    return validMonth(m) ? `${yearOf(m)}-${pad(m)}` : undefined
  }
  return undefined
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 날짜(YYYY-MM-DD)까지 남은 날. 달까지만 아는 날짜는 세지 않는다 */
export function daysUntil(date: string, today: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS)
}
