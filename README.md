# 探究アーカイブ PWA

松本県ヶ丘高校の生徒・教員向けに、探究作品の検索・閲覧・保存ができるWebアプリです。

**[アプリを開く](https://kenryo-tankyu-archive.pages.dev/welcome)**

## 主な機能

- Googleログインと学校利用資格の確認
- タイトル検索、カテゴリ・サブカテゴリ・入学年度・学科の部分一致による条件候補、並び替え
- EmbedPDFによるPDF閲覧、資料切り替え、共有・ダウンロード
- お気に入り、閲覧履歴、検索履歴、端末へのPDF一時保存（72時間）
- お知らせ・通知、ライト／ダークテーマ、PWAインストール

標準の表示順はお気に入り数、KRGP受賞、探究科・普通科の優先順です。作者名・カテゴリ名・PDF本文・要約は通常のキーワード検索対象に含めません。

スマホ・タブレット・PCに対応しています。検索履歴やライブラリは端末内キャッシュを活用して通信を減らし、ログアウトや利用者の切り替え時にキャッシュを破棄します。

## 技術構成

フロントエンドはReact・TypeScript・Vite、PDF表示はEmbedPDFを使用しています。認証・通知はFirebase、作品検索・いいね・履歴はSupabase、PDF保管はCloudflare R2、公開先はCloudflare Pagesです。データへのアクセスは認証・認可を行うAPIを経由します。

このリポジトリはPWAのフロントエンドです。管理サーバー、管理キー、本番作品PDFは含みません。

## ローカル起動

Node.jsは `.nvmrc` に指定された22系を使用してください。

```sh
npm ci
npm run dev -- --port 4173
```

`http://127.0.0.1:4173/welcome` を開きます。実ログインには `.env.example` を参考にFirebase Web設定を `.env.local` に設定し、別途APIサーバーを用意します。開発時のAPI転送先は `localhost:8787` です。

## 確認・ビルド

```sh
npm run format:check
npm run typecheck
npm run lint
npm run build
```

ブラウザテストは `npm test`、機能別テストは `package.json` の `test:*` を参照してください。公開API契約は `src/contracts` に管理側から生成します。

## 素材・ライセンス

画像の出典とハッシュは [config/assets-manifest.json](config/assets-manifest.json) に記載しています。画像や学校の作品の自由な再利用を許諾するものではありません。本リポジトリ全体への一括したOSSライセンスは付与していません。

EmbedPDFはMITライセンスです。SDK・Worker・フォントを同一サイトから配信し、各ライセンスを配信資産に同梱しています。その他の依存ライブラリは各配布元のライセンスに従います。
