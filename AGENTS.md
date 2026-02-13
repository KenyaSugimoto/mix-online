# リポジトリガイドライン

## プロジェクト構造とモジュール構成

このプロジェクトは pnpm workspace を使用したモノレポ構成です。ワークスペースパッケージは `pnpm-workspace.yaml` で定義されている通り、`apps/` および `packages/` 配下に配置されます。共有の TypeScript 設定は `tsconfig.base.json` に集約されています。ドキュメントは `docs/` ディレクトリで管理し、MVP 関連の資料（要件、設計書、OpenAPI/AsyncAPI スペックなど）は `docs/mvp/` 配下にあります。ビルド成果物は各パッケージの `dist/` ディレクトリに出力され、ツールによって無視される設定になっています。

## ビルド、テスト、および開発コマンド

すべてのコマンドはリポジトリのルートから pnpm を使用して実行します：

- `pnpm dev`: すべてのワークスペースアプリを並列で実行します（各パッケージの `dev` スクリプトを呼び出します）。
- `pnpm build`: すべてのワークスペースパッケージをビルドします。
- `pnpm typecheck`: ワークスペース全体の TypeScript 型チェックを実行します。
- `pnpm lint`: Biome を使用してリポジトリ全体の Lint/フォーマットチェックを実行します。
- `pnpm check:contract-literals`: `packages/shared/src/index.ts` の定数値を自動抽出し、`apps/` と `packages/`（`packages/shared` を除く）での文字列リテラル直書きを検知します。
- `pnpm lint:fix`: Biome による修正とフォーマットを適用します。
- `pnpm test`: ワークスペース全体のテスト（Vitest）を実行します。

## コーディングスタイルと命名規則

フォーマットと Lint は Biome (`biome.json`) によって強制されます。JavaScript/TypeScript では、2スペースのインデント、ダブルクォート、セミコロンの使用を推奨します。命名規則は、変数や関数には `camelCase`、クラスやコンポーネントには `PascalCase`、ファイルやフォルダ名には（既存のスタイルが異なる場合を除き）`kebab-case` を使用してください。

## テスティングガイドライン

テストフレームワークとして **Vitest** を導入しています。

- `pnpm test`: ワークスペース全体のテスト（vitest run）を実行します。CIで使用されます。
- `pnpm check:contract-literals`: PR作成前の品質ゲートとして、`pnpm typecheck` / `pnpm test` の前に実行します。
- `pnpm -r test:watch`: 各パッケージでウォッチモードでテストを実行します。
- テストファイル命名規則: `*.test.ts` または `*.spec.ts` とし、原則として対象ファイルと同じ階層の `__tests__/` ディレクトリに配置します。
- 共用パッケージ（`packages/shared`）など、ロジックが集中する場所には必ず単体テストを追加してください。

## コミットおよびプルリクエストのガイドライン

Git の履歴には、短く簡潔な（時には日本語や絵文字を含む）コミットメッセージが使用されています。コミットの要約は簡潔に保ち、既存のスタイルに合わせてください。プルリクエストの際は、変更内容と目的を明確に記載し、`docs/` 内の関連ドキュメントへのリンクを含め、ユーザーの目に触れる動作が変更される場合はスクリーンショットやサンプルを添付してください。
あわせて、PR本文には「このPRでできるようになったこと」と「手動動作確認（最低限試してほしいこと）」を毎回記載してください（前提・手順・期待値を明記）。

## AIエージェント運用ルール（必読）

AIエージェントは、実装タスクを開始する前に以下を必ず適用すること。

- 詳細ルール: [`.agent/rules/github-operations.md`](./.agent/rules/github-operations.md)
- すべてのタスクで **Plan -> Do -> Check -> Act** の順に進める
- 作業開始前に **最新mainから作業ブランチを作成** する（`codex/` プレフィックス必須）
- ユーザーから明示指示があるまで **コミットしない**
- 作業ごとに **更新可能なドキュメントを確認** し、該当があれば同一タスク内で更新する
- 完了時は `pnpm lint` / `pnpm check:contract-literals` / `pnpm typecheck` / `pnpm test` を実行し、結果を報告する
- フロントエンドUI実装・UI改善・デザイン検討タスクでは、`/Users/kenya/dev/github.com/KenyaSugimoto/mix-online/.codex/skills/ui-ux-pro-max/` を必ず利用する
  - 実装前に `python3 .codex/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system` で方針を生成
  - 永続化が必要な場合は `--persist -p "<ProjectName>"` を付与して `design-system/` に保存
  - `.claude` 互換パスが必要な場合は `pnpm uiux:link-claude` を実行し、`.claude/skills/ui-ux-pro-max` シンボリックリンクを再生成する
  - 生成された `design-system/<project>/MASTER.md` の方針に反するUI実装を行う場合は、理由を最終報告に明記する

`AGENTS.md` と `/.agent/rules/github-operations.md` に差分がある場合は、より厳しい方を優先する。

## データベース

データベースには **Supabase**（マネージドPostgreSQL）を採用しています。

- マイグレーション管理: **Supabase CLI** (`supabase migration`) を使用予定
- ローカル開発: `supabase start` でDocker上にSupabase互換環境を起動
- DDL正本: `supabase/migrations/` に生SQLとして保持（テーブル定義・インデックス・初期データ）
- 本番適用: `supabase db push` でリモートプロジェクトへ反映

## ドキュメントの更新

現在、このリポジトリにおいてドキュメントは主要な成果物です。各セクションは短く構造的に保ち、`docs/mvp/` 配下のファイルを更新する際は関連ドキュメントへの相互リンクを維持してください。

AIエージェントは、すべての作業で以下を実施すること。

- 作業開始時に「更新対象になりうるドキュメント」を列挙する
- 実装で事実が変わった箇所は、その都度ドキュメントへ反映する
- 変更がない場合も「更新不要の理由」を最終報告で明示する
