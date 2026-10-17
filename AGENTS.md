# 公開PWAの作業規約

- Vite＋React＋TypeScript。ネイティブコードは使用しない。
- ゴシック体、既存の許可済み画像、発見するギャラリー型UI。
- スマホ・iPad・PCを画面幅と入力能力で最適化する。
- Googleログイン限定。認可はAPIでも必ず実施する。
- 先生図鑑とスクリーンショット検知は対象外。
- PDFの手動ダウンロードとアプリ内72時間保存は区別する。
- privateの管理パッケージ・相対パスへ依存しない。公開可能なAPI契約と架空データで検証できるようにする。
- 管理ワークスペース内では親の移行仕様書.mdが全体の正本。公開cloneでは本READMEと公開API契約を入口にする。
- 変更に応じた型・lint・build・重要なテストを実行する。未実装・未検証を完了扱いしない。
- 鍵・学生一覧・本番PDF・管理仕様をGitへ追加しない。

## T04以降の実装

- 入口はREADMEの変更先表。ルート・共通UIはsrc/app、機能はsrc/features、SWはsrc/sw。
- 公開契約はsrc/contractsの生成物を使用し、手編集しない。所有者による再生成と両側の版/hash確認を行う。
- サンプルと実APIを混同しない。通常buildでは@preview-routesをDisabledPreviewへ解決して架空データを除外する。
- Google認証を接続するまで通常buildのログインは準備中。VITE_ENABLE_PREVIEWを認証や公開許可に使わない。
- SWにAPIやPDFの包括的なキャッシュを加えない。本人ごとの72時間保存は後続の明示した設計で実装する。
- npm run format:check/typecheck/lint/build、npm test、通常buildに対するnpm run test:productionを変更に応じて実施。
