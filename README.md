# 探究アーカイブ PWA

長野県松本県ケ丘高等学校の生徒向けに、先輩の探究作品を発見するWebアプリ。Vite＋React＋TypeScript、既存イラスト、ゴシック体で実装しています。

T04ではWelcome、ギャラリー、作品詳細の見本、ライブラリの見本、端末に応じた外枠、PWAの画面キャッシュまで完成しています。Google認証・実作品検索・PDF・72時間保存・通知は後続工程です。通常の本番buildではサンプル画面を含めず、ログインボタンは準備中と表示します。まだ生徒向けに公開できる完成状態ではありません。

## 起動・確認

Node.js 22.13以上、npmを使用します。

```sh
npm ci
npm run dev -- --port 4173
```

`http://127.0.0.1:4173/welcome`から「サンプル作品で画面を試す」を選択します。プレビューの作品・作者はすべて架空です。保存はメモリ内だけで、再読込で消えます。実データAPIへの通信はありません。

```sh
npm run format:check
npm run typecheck
npm run lint
npm run build
npx playwright install chromium webkit
npm test
npm run test:production
```

`npm test`は開発画面を4173、`test:production`はbuild済み画面を4174で起動します。CIではブラウザのOS依存物もインストールします。テストはChromium/WebKit、360/820/1280px、分割表示、文字200%、キーボード、ダークモード、外枠のオフラインを検証します。実iPad・実スマホ・実FCMの動作保証ではありません。macOS Safari既定のリンク巡回はOption＋Tabです。

```sh
npm run preview -- --port 4174
```

本番用Service Workerはこのプレビューで動きます。開発時は無効です。更新は画面の案内から適用します。試験用buildにサンプル画面を入れる場合だけ`VITE_ENABLE_PREVIEW=true npm run build`を使います。これは認証の代わりではなく、公開運用には使いません。開発版に戻す際に表示が古ければ、そのlocalhostのService Workerとサイトデータをブラウザで削除します。

## 変更する場所

| 場所                     | 内容                                       |
| ------------------------ | ------------------------------------------ |
| `src/app`                | 入口・ルート・共通ヘッダーとナビゲーション |
| `src/pages`              | Welcome・ご案内・未定義ページ              |
| `src/features/discovery` | サンプル検索・テーマ・作品カード・詳細     |
| `src/features/library`   | プレビュー用の一時保存状態                 |
| `src/components`         | ロゴ・カテゴリ画像・PWA更新案内            |
| `src/styles`             | 色・ゴシック体・画面幅・共通UI             |
| `src/lib`                | 環境設定・認証接続待ちのAPI通信入口        |
| `src/contracts`          | 公開DTO・分類の生成物とhash                |
| `src/sw`                 | 単一Service Worker。通知も将来ここへ統合   |
| `public`                 | 許可された既存画像・PWAアイコン            |
| `tests`                  | 開発画面と通常buildのブラウザ試験          |

大型UIフレームワークやDIコンテナは採用しません。スマホは1列・下部ナビ、タブレットは2列、PCは3列。端末名で固定せず画面幅、hover/pointer、向き・分割表示に追従します。

## 公開契約と境界

親のprivateコードや管理用環境変数をimportせず、このフォルダだけでinstall/buildできます。`npm run contracts:check`は同梱manifestのSHA-256を照合し、build時にも必ず実行します。生成物を手で修正せず、管理側の所有者が契約を更新してアプリへ出力し、両リポジトリをコミットします。同梱hashの確認だけでは管理側の最新版を取得できないので、契約更新時には管理側からの整合確認も必要です。

APIの入口は同一配信元の`/api/`と認証トークンを前提としますが、学校資格の判定はまだ接続していません。API側でも必ず認可します。Service Workerは外枠の公開画像・JS/CSS等だけを保存し、API・PDF・認証情報を保存しません。作品の72時間保存は別工程です。

環境変数は[.env.example](.env.example)を参照してください。Viteに渡す値は公開されます。秘密鍵、学生一覧、本番PDF、管理仕様を追加しません。画像の出典は[docs/assets.md](docs/assets.md)、現在地は[docs/progress.md](docs/progress.md)。本リポジトリの公開とリリースはまだ実施していません。
