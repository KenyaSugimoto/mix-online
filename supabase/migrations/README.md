# Supabase Migration Sources (M1-01)

`supabase/migrations/` をDDLの正本として運用する。
設計資料向けの重複コピーは作成しない。

M1-01時点の初期migration:

| 種別 | ファイル |
| --- | --- |
| テーブル作成 | `20260211190000_create_tables.sql` |
| インデックス作成 | `20260211190100_create_indexes.sql` |
| 初期データ投入 | `20260211190200_seed_initial_data.sql` |

更新ルール:

1. スキーマ変更は `supabase/migrations/` にのみ追加する
2. 変更後は関連ドキュメント（`docs/mvp/`）の参照と説明を同一タスクで更新する
