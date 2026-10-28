import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    // 수집 자료(resources/)와 빌드 산출물이 바뀔 때 개발 서버가 페이지를 새로고침하지 않게 한다
    watch: { ignored: ['**/resources/**', '**/.output/**'] },
  },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url', 'baseLocale'],
    }),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // 서버에서만 쓰는 Firebase Admin(Firestore·Storage)은 번들에 묶으면 __dirname 등 CommonJS 전제가 깨진다.
      // 묶지 않고 의존성을 추적해 .output/server/node_modules로 복사한다(배포 산출물은 .output)
      traceDeps: ['firebase-admin'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
