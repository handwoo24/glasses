import { defineConfig } from 'vitest/config'

// 앱용 vite.config.ts의 플러그인(Start, Nitro, devtools)을 테스트에서 띄우지 않기 위해 분리
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
