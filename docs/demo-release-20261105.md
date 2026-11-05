# 先行確認版の公開記録 — 2026-11-05

- URL: https://demo.kenryo-tankyu-archive.pages.dev
- 同じPagesプロジェクト `kenryo-tankyu-archive` のpreview、配信エイリアス `demo`。
- アプリソース: `96d2d9ed6a74c29ca631fe41d00edb9a937c9b9b`。本番用Firebase公開設定でビルドし、架空データのプレビューは無効。
- 配信ID: `a0f3d268`。固定のdemo URLから利用する。配信ごとのハッシュURLはAPI接続対象外。
- 本番配信は `d7179988-6f77-49c7-a2f7-34d3fcb3e2d9` のまま。本番のPages接続設定も不変。
- Previewに既存APIサービス `tankyu-archive-pwa` を接続。API・管理室の再公開やDB移行は実施していない。
- Firebaseのログイン許可ドメインにdemoのホスト名を追加。既存の許可ドメインは保持。
- デモ専用のPagesゲートウェイはdemoホストとOriginを限定し、既存APIへ認証情報を保持して転送する。本番APIのOrigin検証は変更していない。
- 確認: API health 200、認証なしのsession 401、外部Originは403。ゲートウェイの転送・拒否のテスト成功。Chromium/WebKitでログイン選択画面が有効、ページ例外0件。
- 学校アカウントでの認証完了、認証後の実データ操作・PDF表示は今回未確認。ユーザーの学校アカウントで確認が必要。
- 強制更新に関する最低バージョンのAPI拒否機能は今回実装していない。導入済みと仮定して旧DB構造を削除しない。

共通手順: [作業・公開手順](release-workflow.md)。管理側の実行ログと設定差分は `artifacts/demo-release-20261105/` に保存する。秘密情報を含みうる管理側の記録は公開リポジトリへコピーしない。
