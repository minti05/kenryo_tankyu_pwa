import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Bookmark,
  MonitorSmartphone,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
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
      /^\/(works\/\d{8}|explore|awards|saved|library|notifications)(\?|$)/.test(requested)
        ? requested
        : import.meta.env.VITE_NOTIFICATION_ACCEPTANCE === 'true'
          ? '/notifications'
          : '/account';
  return (
    <div className="page-container">
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className="eyebrow">MATSUMOTO KENRYO HIGH SCHOOL</span>
          <p className={styles.school}>松本県ケ丘高校生徒のための探究アーカイブ</p>
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
            積み重ねてきた探究を、次の好奇心につなぐ場所。
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
            {session && (
              <Link className="button secondary" to={next}>
                {next === '/account' ? 'アカウントを確認' : '続きのページを開く'}
              </Link>
            )}
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
      <section className={styles.introduction}>
        <div>
          <span className="eyebrow">YOUR NEXT QUESTION</span>
          <h2>
            探究のはじまりに、
            <br />
            新しい視点を。
          </h2>
        </div>
        <p>
          このアーカイブには、県ケ丘の生徒が取り組んだ探究の成果を集めます。先輩がどんな疑問を持ち、どう調べ、何を見つけたのか。作品との出会いを、自分のテーマを考えるきっかけに。
        </p>
      </section>
      <section className={styles.steps} aria-label="アーカイブでできること">
        {[
          {
            icon: Compass,
            n: '01',
            title: '気になるテーマを探す',
            text: '14のカテゴリやキーワードから、興味のある問いへ。',
          },
          {
            icon: BookOpen,
            n: '02',
            title: '探究の過程を読む',
            text: 'ポスター・論文・スライド・レポートから、考え方や工夫に触れる。',
          },
          {
            icon: Bookmark,
            n: '03',
            title: '自分の探究につなげる',
            text: '出典と著作者を大切にしながら、次の問いを見つける。',
          },
        ].map((item) => (
          <article key={item.n}>
            <div>
              <item.icon size={23} />
              <span>{item.n}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
      <section className={styles.useAnywhere}>
        <MonitorSmartphone size={34} />
        <div>
          <h2>いつもの端末から、すぐに。</h2>
          <p>
            スマートフォン、iPad、パソコンのブラウザに対応します。
            <br />
            アプリストアからのインストールは不要。ホーム画面への追加も選べます。
          </p>
        </div>
        <Link to="/about" className="text-link">
          利用方法を見る
          <ArrowRight size={17} />
        </Link>
      </section>
      <div className={styles.security}>
        <ShieldCheck size={18} />
        <p>
          作品は学校のアカウントでログインした人に提供する設計です。共有端末では、使い終わったらログアウトしましょう。
        </p>
      </div>
    </div>
  );
}
