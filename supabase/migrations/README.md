# Supabase Migration Sources（M1-02）

`supabase/migrations/` を DDL 正本として運用する。
設計資料向けの重複コピーは作成しない。

## 初期 migration 一覧

| 種別 | ファイル |
| --- | --- |
| テーブル作成 | `20260211190000_create_tables.sql` |
| インデックス作成 | `20260211190100_create_indexes.sql` |
| 初期データ投入 | `20260211190200_seed_initial_data.sql` |

## 前提

1. Docker Desktop（または互換ランタイム）が起動していること
2. Supabase CLI が利用可能であること
3. `supabase/config.toml` が未作成なら、初回のみリポジトリルートで `supabase init` を実行すること

## ローカル起動 + マイグレーション適用 + seed投入手順

以下はすべてリポジトリルートで実行する。

1. ローカル Supabase を起動する
   - `pnpm db:start`
2. マイグレーションを再適用し seed を投入する
   - `pnpm db:reset`
3. 接続情報を確認する（Studio URL / DB URL）
   - `pnpm db:status`

`pnpm db:reset` はローカル DB を再作成し、`supabase/migrations/` の SQL を昇順で再適用する。
そのため、`20260211190200_seed_initial_data.sql` も同時に適用される。

Colima 利用時の補足:

- `pnpm db:start` は、通常の `supabase start` が失敗した場合に自動で DB 最小構成（postgresのみ）へフォールバックする。
- フォールバック時、`pnpm db:status` には `Stopped services` が表示されるが、DB検証（migration/seed確認）用途では正常。

## seed適用の確認クエリ（SQL Editor で実行）

```sql
SELECT COUNT(*) AS table_count FROM tables;
SELECT table_id, COUNT(*) AS seat_count
FROM table_seats
GROUP BY table_id
ORDER BY table_id;
SELECT status, COUNT(*) AS seat_status_count
FROM table_seats
GROUP BY status
ORDER BY status;
```

期待値:

- `table_count = 2`
- `table_seats` は各 `table_id` ごとに `seat_count = 6`
- `status = EMPTY` が `12` 件

## DBリセット運用ルール

1. スキーマ変更後は `pnpm db:reset` で再適用し、SQLレベルで期待値を検証する
2. seed を変更した場合は、本READMEの期待値も同一タスクで更新する
3. ローカル作業終了時は `pnpm db:stop` で停止する

## 更新ルール

1. スキーマ変更は `supabase/migrations/` にのみ追加する
2. 変更後は関連ドキュメント（`docs/mvp/`）の参照と説明を同一タスクで更新する
