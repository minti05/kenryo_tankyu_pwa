import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, MonitorSmartphone, BookOpen } from 'lucide-react';
import { PREVIEW_ENABLED } from '../lib/environment';
export default function AboutPage() {
  return (
    <div className="page-container reading-page">
      <span className="eyebrow">ABOUT THE ARCHIVE</span>
      <h1>探究を、次の人へ。</h1>
      <p className="reading-lead">
        松本県ケ丘高校の生徒が、先輩の問いや工夫に出会い、
        <br />
        自分の探究を考えるためのアーカイブです。
      </p>
      <section>
        <h2>
          <BookOpen size={22} />
          この場所でできること
        </h2>
        <p>
          地域、数学・理科、環境、くらしなどのテーマから探究作品を見つけ、ポスターや論文、スライド、レポートを読める場所を目指しています。作品を使うときは、著作者と出典を明記し、成果をそのまま自分のものとして扱わないでください。
        </p>
        <p>
          現在は画面プレビューの段階です。サンプルは架空の内容で、実作品・PDFは含まれていません。Googleログインは接続設定と動作確認が必要です。通知、PDFのダウンロードと3日間の保存は準備中です。
        </p>
      </section>
      <section>
        <h2>
          <MonitorSmartphone size={22} />
          端末に合わせた使い方
        </h2>
        <p>
          スマートフォンでは片手で使いやすい下部ナビ、iPadなどのタブレットでは2列、広い画面では3列のギャラリーに切り替わります。iPadの画面分割やキーボード操作でも使いやすい設計です。
        </p>
        <p>
          アプリストアは使わず、ブラウザから利用します。ホーム画面への追加は端末やブラウザのメニューから選べます。
        </p>
      </section>
      <section id="privacy">
        <h2>
          <ShieldCheck size={22} />
          プライバシーと端末への保存
        </h2>
        <p>
          実作品は、学校のGoogleアカウントでログインし、利用資格が確認できた人に提供する設計です。メールアドレス・パスワードによるログインは設けません。
        </p>
        <p>
          閲覧済み資料をこの端末で最大3日間保存する機能は準備中です。PDFの手動ダウンロードとは異なり、アプリ内保存は期限とログアウト時に削除する方針です。手動で保存したファイルは利用者が管理してください。
        </p>
      </section>
      <section id="terms">
        <h2>利用とお問い合わせについて</h2>
        <p>
          プレビューの保存操作は画面を試すためのもので、再読み込みするとリセットされます。現在、個人の閲覧履歴や保存内容をサーバーへ送る処理はありません。
        </p>
        <p>
          正式な提供開始前に、運営者・問い合わせ先・利用条件・個人情報の取扱いをここで案内します。学校の公式サービスとしての承認や、未確定の連絡先をこのプレビューで表示するものではありません。
        </p>
      </section>
      {PREVIEW_ENABLED ? (
        <Link className="button primary" to="/preview/explore">
          画面プレビューを試す
          <ArrowRight size={17} />
        </Link>
      ) : (
        <Link className="button secondary" to="/welcome">
          Welcomeへ戻る
        </Link>
      )}
    </div>
  );
}
