/**
 * 차트 색은 styles.css의 CSS 변수로만 쓴다(라이트/다크 자동 전환).
 * 팔레트는 dataviz validate_palette.js로 두 모드 모두 검증했다.
 *  - 범주(최대 3): light #2a6fb8 #d26a2c #1f9a72 / dark #3d84cf #c9632a #1c946c
 *  - 증감: light 증가 #00826a 감소 #c2412d / dark #1f9e7e #d5583f
 */
export const SERIES = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
] as const

export const UP = 'var(--color-up)'
export const DOWN = 'var(--color-down)'
export const NEUTRAL = 'var(--color-total)'
export const HIGHLIGHT = 'var(--color-series-1)'
export const GRID = 'var(--color-rule)'
export const AXIS_TEXT = 'var(--color-muted)'
