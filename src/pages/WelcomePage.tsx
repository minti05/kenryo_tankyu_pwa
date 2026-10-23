import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { CategoryArt } from '../components/CategoryArt';
import { PREVIEW_ENABLED } from '../lib/environment';
import styles from './WelcomePage.module.css';
import { useAuth } from '../features/auth/context';
export default function WelcomePage() {
  let deletionReceipt: string | null = null;
  try {
    deletionReceipt = sessionStorage.getItem('account-deletion-receipt');
  } catch {
    /* Some browsers disable session storage. */
  }
  const { ready, configured, busy, error, session, signedIn, login, logout, retry } = useAuth();
  const [params] = useSearchParams(),
    requested = params.get('next'),
    next =
      requested &&
      requested.length < 2000 &&
      /^\/(works\/\d{8}|home|search|results|explore(?:\/[a-z]+)?|awards|saved|library|notifications|account)(\?|$)/.test(
        requested,
      )
        ? requested
        : import.meta.env.VITE_NOTIFICATION_ACCEPTANCE === 'true'
          ? '/notifications'
          : '/home';
  if (ready && session) return <Navigate to={next} replace />;
  return (
    <div className="page-container">
      <section className={styles.hero}>
        <div className={styles.copy}>
          {deletionReceipt && (
            <p role="status">
              退会手続きを受け付けました。運営側で削除処理を完了します。受付番号：{deletionReceipt}
            </p>
          )}
          <h1>
            先輩の問いから、
            <br />
            自分の<span>探究</span>を<br className={styles.mobileBreak} />
            見つけよう。
          </h1>
          <p className={styles.lead}>
            まちの小さな疑問も、世界を変えるアイデアも。
            <br />
            松本県ヶ丘高校の生徒と教員のみが使用できます。
          </p>
          <div className={styles.login}>
            <button
              className="button primary"
              disabled={!configured || !ready || busy || !!session}
              onClick={login}
            >
              <img src="/images/google-logo.svg" alt="" width="18" height="18" />
              学校のGoogleアカウントでログイン
            </button>
            <p>
              {!configured
                ? 'Googleログインは準備中です。'
                : busy
                  ? '利用資格を確認しています…'
                  : session
                    ? 'ログイン済みです。'
                    : '学校のGoogleアカウントでログインできます。'}
              <br />
              <span>@kenryo.ed.jp のアカウントと利用資格が必要です。</span>
            </p>
            {error && <p role="alert">{error}</p>}
            {signedIn && !session && !busy && (
              <button
                className="button secondary"
                onClick={() => {
                  void retry();
                }}
              >
                利用資格を再確認
              </button>
            )}
            {signedIn && (
              <button
                className="button quiet"
                onClick={() => {
                  void logout();
                }}
              >
                ログアウトして選び直す
              </button>
            )}
            {PREVIEW_ENABLED && (
              <Link className="text-link" to="/preview/explore">
                サンプル作品で画面を試す
                <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </div>
        <div
          className={styles.gallery}
          aria-label="既存カテゴリ画像でつくった探究テーマのギャラリー"
        >
          <div className={styles.galleryHeader}>
            <span>THE WORLD OF INQUIRY</span>
            <span>01 — 04</span>
          </div>
          <div className={styles.artGrid}>
            {[
              { id: 'society', label: '地域', copy: 'いつもの街を、\n違う視点で。' },
              { id: 'science', label: '数学・理科', copy: '「なぜ？」から\n始まる発見。' },
              { id: 'environment', label: '環境問題', copy: '未来のあたりまえを\n考えてみる。' },
              { id: 'life', label: 'くらし', copy: '身近なことほど、\nおもしろい。' },
            ].map((item, index) => (
              <div className={styles.artTile} key={item.id} data-tone={index}>
                <span className={styles.artNumber}>0{index + 1}</span>
                <CategoryArt category={item.id as 'society' | 'science' | 'environment' | 'life'} />
                <div>
                  <span>{item.label}</span>
                  <p>{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.galleryCaption}>きっと、気になる問いが見つかる。</p>
        </div>
      </section>
    </div>
  );
}
