import '../styles/motion.css';
import { NavigationMotion } from '../components/NavigationMotion';
import { DisplayPreviewBanner } from '../features/auth/DisplaySettings';
import { NotificationBridge } from '../features/notifications/NotificationBridge';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Compass, LibraryBig, Home, Search, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../features/auth/context';
import { NotificationMenu } from '../features/notifications/NotificationMenu';
import { ResultsHeader } from '../features/discovery/ResultsHeader';
import { useDesktopReader } from '../features/works/reader-layout';
import { WorkHeaderTarget } from '../features/works/header-context';
import { SearchHeaderTarget } from '../features/discovery/search-header-context';
import { DesktopSearch } from '../features/discovery/DesktopSearch';
import { AccountAvatar } from '../features/auth/AccountAvatar';
import { Brand } from '../components/Brand';
import { PolicyLinks } from '../components/PolicyLinks';
import { PdfPreparation } from '../components/PdfPreparation';
import { InstallNotice } from '../features/install/InstallNotice';
import { PwaNotice } from '../components/PwaNotice';
import { ReadingTipsSync } from '../components/ReadingTipsSync';
export function Layout() {
  const { session, offline } = useAuth(),
    location = useLocation(),
    main = useRef<HTMLElement>(null),
    previous = useRef(location.pathname);
  const preview = location.pathname.startsWith('/preview'),
    appNavigation = !!session && !preview;
  const desktopReader = useDesktopReader();
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [searchHeaderTarget, setSearchHeaderTarget] = useState<HTMLDivElement | null>(null);
  const searchPage = location.pathname === '/search';
  const awards = location.pathname === '/awards',
    results = ['/results', '/awards'].includes(location.pathname),
    work = location.pathname.startsWith('/works/'),
    from = new URLSearchParams(location.search).get('from'),
    category = new URLSearchParams(location.search).get('category'),
    categoryBack = !awards && results && category && !new URLSearchParams(location.search).get('q'),
    back =
      work &&
      from &&
      /^\/(home|search(?:\/chat)?|results|explore|awards|library|saved)(\?|$)/.test(from)
        ? from
        : work
          ? offline
            ? '/saved'
            : '/explore'
          : awards
            ? '/home'
            : categoryBack
              ? `/explore/${encodeURIComponent(category!)}`
              : '/search';
  useEffect(() => {
    if (previous.current === location.pathname) return;
    previous.current = location.pathname;
    if (
      !main.current?.contains(document.activeElement) &&
      !document.activeElement?.closest('.search-header-target, dialog, [role="dialog"]')
    )
      main.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (
      !location.pathname.startsWith('/works/') &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const animation = main.current?.animate([{ opacity: 0.65 }, { opacity: 1 }], {
        duration: 200,
        easing: 'ease-out',
      });
      return () => animation?.cancel();
    }
  }, [location.pathname]);
  return (
    <div
      className={
        (preview ? 'app-shell is-preview' : appNavigation ? 'app-shell signed-in' : 'app-shell') +
        (appNavigation && work ? ' work-focused' : '') +
        (appNavigation && searchPage ? ' search-focused' : '') +
        (appNavigation && (results || work) ? ' contextual-page' : '')
      }
    >
      <ReadingTipsSync />
      <a className="skip-link" href="#main">
        本文へ移動
      </a>
      <header className="site-header">
        <div className="header-inner">
          <div className="header-brand">
            <Brand to={session ? '/home' : '/welcome'} />
          </div>
          {appNavigation && searchPage && !desktopReader ? (
            <div className="search-header-target" ref={setSearchHeaderTarget} />
          ) : appNavigation && (results || work) ? (
            <div className="contextual-header">
              <Link
                className="icon-button"
                to={back}
                aria-label={
                  work
                    ? '一覧へ戻る'
                    : awards
                      ? 'ホームに戻る'
                      : categoryBack
                        ? 'サブカテゴリに戻る'
                        : '検索に戻る'
                }
              >
                <ArrowLeft size={23} />
              </Link>
              {work && desktopReader ? (
                <ResultsHeader source={back} />
              ) : work ? (
                <div className="work-toolbar-target" ref={setHeaderTarget} />
              ) : (
                <ResultsHeader />
              )}
            </div>
          ) : appNavigation ? (
            <>
              {location.pathname !== '/search' && <DesktopSearch />}
              <div className="header-actions">
                <NotificationMenu />
                <Link
                  className="icon-button mobile-search"
                  to="/search"
                  aria-label="検索画面を開く"
                >
                  <Search size={23} />
                </Link>
                <Link
                  className="icon-button desktop-account"
                  to="/account"
                  aria-label="アカウント設定"
                >
                  <AccountAvatar />
                </Link>
              </div>
            </>
          ) : (
            <span className="school-mark">
              松本県ケ丘高校
              <br />
              <b>探究アーカイブ制作委員会</b>
            </span>
          )}
        </div>
      </header>
      {import.meta.env.VITE_NOTIFICATION_ACCEPTANCE === 'true' && (
        <aside className="preview-banner">
          <b>通知の接続テスト専用</b>
          <span>対象アカウントのみ利用できます。作品・PDFの本番提供は準備中です。</span>
          <Link to="/notifications">お知らせへ</Link>
        </aside>
      )}
      {preview && (
        <div className="preview-banner">
          <span>
            <b>画面プレビュー</b> 表示している作品・作者は架空のサンプルです。
          </span>
          <Link to="/welcome">
            Welcomeへ
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      {offline && (
        <aside className="offline-banner" role="status">
          オフラインで利用中 · <Link to="/saved">履歴の管理を開く</Link>
        </aside>
      )}
      <DisplayPreviewBanner />
      <main id="main" tabIndex={-1} ref={main}>
        <WorkHeaderTarget.Provider value={headerTarget}>
          <SearchHeaderTarget.Provider value={searchHeaderTarget}>
            <Outlet />
          </SearchHeaderTarget.Provider>
        </WorkHeaderTarget.Provider>
      </main>
      {work && appNavigation ? null : appNavigation || preview ? (
        <nav className="app-nav" aria-label="メインナビゲーション">
          <NavigationMotion />
          <NavLink to={preview ? '/welcome' : '/home'}>
            <Home size={23} />
            <span>ホーム</span>
          </NavLink>
          <NavLink
            to={preview ? '/preview/explore' : '/explore'}
            className={({ isActive }) =>
              isActive ||
              ['/search', '/search/chat', '/results', '/awards'].includes(location.pathname)
                ? 'active'
                : ''
            }
          >
            <Compass size={23} />
            <span>探索</span>
          </NavLink>
          <NavLink to={preview ? '/preview/library' : '/library'}>
            <LibraryBig size={23} />
            <span>ライブラリ</span>
          </NavLink>
          {appNavigation && (
            <NavLink
              className={({ isActive }) =>
                `mobile-account ${isActive || location.pathname === '/saved' ? 'active' : ''}`
              }
              to="/account"
              aria-label="アカウント設定"
            >
              <AccountAvatar />
              <span>アカウント</span>
            </NavLink>
          )}
        </nav>
      ) : (
        <footer className="public-footer">
          <PolicyLinks />
        </footer>
      )}
      <PwaNotice />
      <InstallNotice />
      <PdfPreparation />
      <NotificationBridge />
    </div>
  );
}
