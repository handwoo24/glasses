import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { getLocale } from '#/paraglide/runtime'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

/** 제목·본문 본고딕, 인용 본명조 (glasses 디자인 시스템 v2) */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@500&display=swap'

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', getLocale())
    }
  },

  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'glasses · 공공사업 리포트' },
      {
        name: 'description',
        content:
          '정부와 지자체의 공공사업과 예산을 공개 자료로 정리하고 7개 축으로 평가한 공익 오픈소스 리포트',
      },
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'stylesheet', href: FONTS },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <a href="#main" className="skip">
          본문 바로가기
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}

function SiteHeader() {
  return (
    <header className="site-head">
      <div className="topbar">
        <Link to="/" className="home">
          <b>glasses</b>
          <span>공공사업 리포트</span>
        </Link>
        <nav aria-label="주 메뉴" className="site-nav">
          <Link
            to="/orgs"
            search={{ view: 'ministries' }}
            activeOptions={{ includeSearch: true }}
          >
            부처
          </Link>
          <Link
            to="/orgs"
            search={{ view: 'regions' }}
            activeOptions={{ includeSearch: true }}
          >
            지역
          </Link>
          <Link to="/vendors">용역</Link>
          <Link to="/method">평가 기준</Link>
        </nav>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        <p>
          glasses는 공익 목적의 오픈소스 프로젝트입니다. 소스 코드는 AGPL-3.0,
          리포트는 CC BY 4.0을 따릅니다.
        </p>
        <p>
          원문 저작권은 각 기관에 있으며, 공공누리 이용조건에 따라 링크로
          제공합니다.
        </p>
      </div>
    </footer>
  )
}
