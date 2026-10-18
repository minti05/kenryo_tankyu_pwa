# 探究アーカイブ PWA

長野県松本県ケ丘高等学校の生徒向けに、先輩の探究作品を発見するWebアプリ。Vite＋React＋TypeScript、既存イラスト、ゴシック体で実装しています。

T04ではWelcome、ギャラリー、作品詳細の見本、ライブラリの見本、端末に応じた外枠、PWAの画面キャッシュまで完成しています。T05でGoogle専用ログインとAPIの学校資格確認を接続しました。実クラウド設定は未投入で、実作品検索・PDF・72時間保存・通知は後続工程です。通常の本番buildではサンプル画面を含めず、接続設定がない場合のログインボタンは準備中と表示します。まだ生徒向けに公開できる完成状態ではありません。

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
npm run test:auth-config
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
| `src/features/auth`      | Google認証・資格照合・アカウント画面       |
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

APIの入口は同一配信元の`/api/`と認証トークンを前提としますが、学校資格はAPIのGET /api/sessionで確認し、結果の版・UID・役割をクライアントでも検証します。実クラウドとの確認は未実施です。API側でも必ず認可します。Service Workerは外枠の公開画像・JS/CSS等だけを保存し、API・PDF・認証情報を保存しません。作品の72時間保存は別工程です。

環境変数は[.env.example](.env.example)を参照してください。Viteに渡す値は公開されます。秘密鍵、学生一覧、本番PDF、管理仕様を追加しません。画像の出典は[docs/assets.md](docs/assets.md)、現在地は[docs/progress.md](docs/progress.md)。本リポジトリの公開とリリースはまだ実施していません。

## Googleログインの接続（T05）

`.env.example`のFirebase Web設定3項目を`.env.local`へ指定します。Workerと同じFirebase projectを使用します。設定が揃うと公式SDKを遅延読込し、初期化後にGoogle専用ボタンを有効化します。学校メールの選択支援だけを認可にせず、APIでもGoogle経路・学校メール・利用資格・停止失効を確認します。

Vite開発時の/apiはlocalhost:8787へ転送します。API側のOrigin設定と検証環境の資格が必要です。認証成功後は/accountで確認できます。作品の実データ画面へはまだつないでいません。403はアカウントの選び直し・資格の再確認、401はログアウトして再ログイン、障害時は再試行します。同じメールという理由で異なるFirebase UIDを結合しません。既存passwordアカウントとの連携は運営者が確認してください。

Firebase SDKのブラウザ永続状態を使い、アプリ独自のトークン保存はしません。ログアウト/利用者変更時はQueryの状態と確認済み資格を破棄します。PDF・Pushの後片付けはそれぞれの機能を接続するときに追加します。共有端末では必ずログアウトします。

`test:auth-config`は架空のFirebase公開設定で別の.cache/auth-buildを生成し、Chromium/WebKitでSDK初期化とボタン有効化を確認します。外部HTTPSを遮断し、実Googleログインは行いません。実端末のpopup/キャンセル・UID保持・資格停止・再ログインは検証環境での受入に残ります。

Firebase13はNode24.12以上の要件があるため、Node22に対応する12系最新版12.19.0を固定しました。互換依存の解決でNode24要件のapp/app-compatが入らないよう同梱系列を固定し、未使用FirestoreのNode依存grpc-jsは同じmajorの修正版1.14.6へoverrideしています。ブラウザへFirestoreやgRPCはimportしません。SDK更新時はNode要件、overrideの除去可否、audit、ブラウザ動作を再確認してください。

## 検索・探索・KRGP（T08）

ログインと資格確認後、`/explore`で検索・正式分類2組/サブカテゴリ/年度/学科/資料種別・ページ送り、`/awards`でKRGPの賞・賞名を使う。URLに条件を保持し、`/works/:id?from=...`から一覧へ戻れる。PDF詳細はT09準備中。実一覧の保存/人気順を未接続のまま表示しない。

主な変更先はsrc/features/discovery/SearchPage.tsx、LiveWorkCard.tsx、src/contracts/discovery.generated.ts。AuthProviderのrequestが現在のUIDのトークンを付け、本人別のquery keyとログアウト時clearで状態を分離する。結果を長期キャッシュせず、検索語の入力中にAPI履歴を保存しない。履歴削除は個別/全件に対応し、全件だけ確認する。

```bash
npm run test:discovery
```

スマホ/iPad/PC相当の幅でChromium/WebKitを確認。tests/discovery-harness.htmlは模擬認証と模擬APIを使う**テスト専用入口**で、srcからimportせず通常buildへ含めない。通常buildの未ログイン検索でAPIを送らないことも検証する。実Google・実作品・実iPad等での受入の代わりではない。保護APIの応答をService Workerへ丸ごとキャッシュしない。

## T09：作品詳細とPDF

`src/features/works/WorkPage.tsx`が認証済み詳細と資料切替・共有・手動保存、`pdf-data.ts`が長さ/版/SHA照合、`PdfViewer.tsx`が1ページ表示・拡大・解放、`pdf-runtime.ts`がPDF.jsの遅延読込を担当します。公開契約は`src/contracts/documents.generated.ts`です。

Mozilla公式pdfjs-dist6.4.299のlegacy build（Apache-2.0）を使用。SDKと専用Worker・補助資産は同じ版で同梱し、`scripts/copy-pdf-assets.mjs`で開発/ビルド前に生成します。外部CDNは使いません。生成先public/pdfjsは専用の出力先で、実作品を置かないでください。Welcome時に重いSDKをprecacheしません。公式のPDFエンジンSafari対応は18以降が対象（mostly）です。外枠の16.4 targetと同じ保証ではありません。旧端末/描画失敗時はPDF保存からOSで開く方法を案内し、学校iPadのOSと保存操作は実機受入が必要です。

PDF APIはGoogle/学校資格と正本の公開状態を確認します。全量最大3,000,000 bytes、実体版・長さ・SHAを照合。資料表示済みのBlobを保存にも使い、直前HEADを通して二重GETを避けます。5秒以内の保存リンクをユーザーが押す方式で、保存後のOSファイルは72時間の自動削除対象外です。共有は作品URLだけで、共有先もログイン必須。

`npm run test:pdf`は架空の縦/横2ページPDFをChromium/WebKitと3画面幅で検証します。実資料の任意ローカル受入は`TANKYU_PDF_PATH`を指定し、`--grep 実SSD --workers 1`で実行します。スクリーンショットは`TANKYU_PDF_SCREENSHOT`でGit外を指定します。作品をpublicやGitへコピーしません。通常buildにテスト認証入口がないことも検査します。

T09はローカル受入まで。実Google/R2の配信、学校端末、実CPU/費用と一般公開は未受入。72時間の自動保存・オフライン資産準備はT10、本人閲覧状態は後続です。

## T10：3日間の保存とオフライン

オンラインで閲覧できた資料だけを、この端末へ72時間保存します。`/saved`に件数・PDF容量・期限・残り時間を表示し、個別/全件/期間で削除できます。オフライン閲覧で期限は延びず、手動ダウンロードしたOSのファイルは自動削除できません。

`src/features/offline/store.ts`がIndexedDB・本人・期限・容量（PDF本体100MiB）・SHA照合を所有します。WebKit互換のためPDF本体はArrayBufferで保存し、使用時にBlobへ戻します。`SavedPage.tsx`と`OfflineWorkPage.tsx`が画面、`assets.ts`と`src/sw/pdf-assets.ts`が固定SDKの明示保存、`src/sw/expiry.ts`がSW側掃除です。

Firebase永続状態の同じUIDと前回の認可が期限内の場合だけオフラインへ復帰します。初回オフラインログインや新しい検索・未保存資料の取得はできません。オンラインでは資格APIを必ず確認し、403/401・ログアウト・利用者切替で保存を消します。別タブと遅い保存もepoch/fenceで無効にします。オンラインで再閲覧した同じ版は、HEADで再認可して保存データを再利用します。

時刻はサーバー認可時刻と経過時間を基準にし、60秒超の巻戻しではオフライン利用を止めます。期限後は読み取りを拒否し、起動・復帰・定期・使用時に削除します。閉じたまま期限ちょうどに物理削除することや、通信断中の管理者失効の即時反映はできません。ブラウザの空き容量/プライベートモード/サイトデータ削除でも保存が失われます。

表示SDKは最初の閲覧後に203ファイル/約5.34MBを明示準備し、PDF本体とは別の公開資産cacheへ保存します。準備未完了や容量不足は画面で案内し、オンライン表示は継続します。保護API/PDFをService Workerで包括cacheしません。

`npm run test:offline`は`.cache/offline-build`へ隔離した試験ビルドです。実AuthProvider/IndexedDB/SW/PDF.jsを使い、Firebaseの状態とHTTP応答だけを架空のfixtureに置換します。`TANKYU_OFFLINE_TEST_BUILD=1`はこの出力先以外では拒否します。通常buildは本来のFirebase SDKのまま、fixtureの漏れを検査します。試験ビルドを公開しないでください。

学校の実端末・実Firebase/R2・HTTPSでの保存/再起動・低容量・長時間休止・SW更新の受入は別途必要です。実サービスの一般公開はまだ行っていません。通知と本人のクラウド閲覧状態は後続です。

## T11：本人ライブラリ・報告・退会

`/library`は本人のクラウド閲覧履歴・お気に入りと統計を表示します。`/saved`はこの端末の72時間PDF保存です。作品画面にお気に入りと4種類の報告、アカウント画面にGoogle再認証による退会を追加しました。履歴はPDFの初ページ表示後に記録します。

`src/features/library`が一覧・操作・再試行、`AuthProvider`が再認証と退会受付後の端末保存破棄を担当します。履歴の個別削除はお気に入りも外し、全件・期間削除ではお気に入りを残します。統計は日本時間の最新閲覧日時による作品数です。旧Firestoreのいいね数とSupabaseのお気に入り人数は区別します。

`npm run test:library`と`npm run test:offline`で操作、失敗、再認証中断と受付後の応答不明を確認します。開発専用`/tests/progress-harness.html`で架空データのT11画面を操作できます。通常本番buildへこの入口は含めません。

実Google・学校資格・Supabase/R2は未接続です。退会はpending受付と運営側の永続processorを分け、受付を削除完了とは表示しません。実環境の定期実行・失敗監視・T12通知トークンの削除も公開前に必要です。秘密の管理SDKをブラウザへ入れないでください。

## T12：端末への通知とお知らせ

`/notifications`で一覧・内容・既読と、この端末だけの通知登録/停止を扱います。`src/features/notifications`が画面と前景受信、`src/sw/notifications.ts`が既存の単一SW内で背景受信/タップを担当します。通知を押すと認証済みAPIから本文を読みます。OS通知には一般文だけを表示します。

Push設定は`.env.example`のFirebase公開設定とVAPID公開鍵です。送信鍵・管理SDK JSON・Supabase秘密鍵をアプリへ入れません。iPhone/iPadは対応OSでホーム画面へ追加したアプリから利用する必要があります。通知は明示操作で許可を求め、拒否/未対応/設定準備中も一覧を使えます。

`test:offline`では通知登録/前景/背景/タップ/停止/ログアウト後の表示抑止を追加しました。架空のFCM輸送・OS通知表示を隔離ビルドだけで置換し、実際の画面/保存/SWの照合処理を検証します。通常buildにはこれらのfixtureを含めません。`VITE_NOTIFICATION_ACCEPTANCE=true`は一名限定の実通知試験に使う専用ビルドだけの設定です。

実Androidの受信とタップは確認済み。追加実機確認は保留中です。通常Supabase通知RPCと恒久公開先は未配置で、一時URLの試験成功を一般公開の完成とは扱いません。
