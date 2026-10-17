import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Compass, LibraryBig, Info, ArrowUpRight } from 'lucide-react';
import { Brand } from '../components/Brand';
import { PwaNotice } from '../components/PwaNotice';
export function Layout() {
  const location = useLocation(),
    main = useRef<HTMLElement>(null),
    previous = useRef(location.pathname),
    preview = location.pathname.startsWith('/preview');
  useEffect(() => {
    if (previous.current === location.pathname) return;
    previous.current = location.pathname;
    main.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  return (
    <div className={preview ? 'app-shell is-preview' : 'app-shell'}>
      <a className="skip-link" href="#main">
        本文へ移動
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav
            aria-label="メインナビゲーション"
            className={preview ? 'primary-nav' : 'primary-nav public-nav'}
          >
            {preview && (
              <>
                <NavLink to="/preview/explore">
                  <Compass size={18} />
                  見つける
                </NavLink>
                <NavLink to="/preview/library">
                  <LibraryBig size={18} />
                  ライブラリ
                </NavLink>
              </>
            )}
            <NavLink to="/about">
              <Info size={18} />
              ご案内
            </NavLink>
          </nav>
          <span className="school-mark">
            松本県ケ丘高校
            <br />
            <b>探究を、つなぐ。</b>
          </span>
        </div>
      </header>
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
      <main id="main" tabIndex={-1} ref={main}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>探究アーカイブ</span>
        <p>ひとつの問いを、次の一歩へ。</p>
        <div>
          <Link to="/about#privacy">プライバシー</Link>
          <Link to="/about#terms">利用について</Link>
        </div>
        <small>長野県松本県ケ丘高等学校 生徒向け</small>
      </footer>
      <PwaNotice />
    </div>
  );
}
