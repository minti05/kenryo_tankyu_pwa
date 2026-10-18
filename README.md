# 探究アーカイブ PWA

松本県ケ丘高校の生徒が探究作品を探し、PDFを閲覧できるWebアプリです。Vite・React・TypeScriptで実装しています。

**[限定公開版を開く](https://kenryo-tankyu-archive.pages.dev/welcome)**

Googleログイン、作品検索・分類・年度・KRGP、PDF表示とダウンロード、閲覧済み資料の72時間保存、履歴・お気に入り・報告、退会受付、お知らせ・Web Pushを実装しています。利用にはAPI側の学校資格が必要です。一般提供に向けた実機・費用・運営面の確認は継続中です。AIベクトル検索は未実装です。

## 起動

Node.js 22.13以上を使用します。

```sh
npm ci
npm run dev -- --port 4173
```

`http://127.0.0.1:4173/welcome` を開きます。開発用のサンプル作品は架空です。実ログインは `.env.example` を参考に `.env.local` へFirebase Web設定を入れ、同一originの `/api` を提供する認可サーバーを別途用意してください。開発時のAPI転送先はlocalhost:8787です。この公開リポジトリに管理サーバーや管理キーは含めません。

```sh
npm run format:check
npm run typecheck
npm run lint
npm run build
npx playwright install chromium webkit
npm test
npm run test:offline
npm run test:pdf
npm run test:library
npm run test:discovery
npm run test:production
npm run test:auth-config
```

CIでも同じ検証を実施します。通常の本番buildには試験用認証・サンプル経路を含めません。`.cache/offline-build` 等の試験ビルドを公開しないでください。`.env` はGit対象外、`VITE_*` はブラウザへ公開される値です。

## 編集の入口

| 場所                           | 内容                                             |
| ------------------------------ | ------------------------------------------------ |
| src/app・pages・styles         | ルート、Welcome、外枠、ゴシック体の共通デザイン  |
| src/features/auth・lib         | Google認証、資格照合、認証済みAPI通信            |
| src/features/discovery・works  | 作品検索・一覧・PDF表示とダウンロード            |
| src/features/offline・library  | 本人別72時間保存、クラウド履歴・お気に入り・報告 |
| src/features/notifications・sw | お知らせ、Push、単一Service Worker               |
| src/contracts                  | 管理側から生成された公開API契約と同梱hash        |
| tests                          | 架空データによるブラウザ試験                     |

privateコードをimportせず、単独でinstall/buildできます。契約の編集元は管理側です。生成物を手編集せず、所有者が再生成して両側のhashを確認します。スマホ・タブレット・PCへ画面幅/入力能力で追従します。

## 保存・通知について

PDFは表示できたものだけ本人別に72時間保存し、ログアウト・認可拒否・利用者変更で破棄します。OSへ手動ダウンロードしたファイルは期限削除の対象外です。ブラウザ容量不足で保存は失われ得ます。保護API/PDFをService Workerで丸ごとキャッシュしないでください。

通知許可はユーザーの明示操作で求めます。iPhone/iPadは対応OSのホーム画面アプリで確認が必要です。旧URLから新URLへはログイン・通知登録・インストールをやり直してください。

## 画像・依存ライブラリ

既存アプリのアイコン、ワードマーク、14分類の画像とGoogleマークを、利用者の再利用・公開指示に基づき同じバイト列で使用しています。元ファイルとSHA-256は [config/assets-manifest.json](config/assets-manifest.json) に記録しています。教員画像、生徒一覧、本番作品PDFは同梱しません。

各画像の個別著作者・再配布条件は未確定です。このソース公開は画像や学校の作品の自由な再利用許諾を意味しません。GoogleマークはGoogleログイン用途です。著作権者の確認・必要表記の整理は運営側の残作業です。

PDF表示はMozilla公式pdfjs-dist（Apache-2.0）のSDK・Worker・補助資産を同じ版で生成して同梱します。外部CDNへPDFを送信しません。依存パッケージのライセンスは各配布元に従います。本リポジトリ全体への一括したOSSライセンスは現在付与していません。

FirebaseはNode22互換の12系を固定し、互換app/app-compatを同梱系列へ、間接grpc-jsを同major修正版へoverrideしています。SDK更新時にはNode要件・overrideの要否・audit・ブラウザ互換を確認してください。PDF描画エンジンの対応範囲とアプリ外枠のSafari16.4 targetは同じ保証ではありません。
