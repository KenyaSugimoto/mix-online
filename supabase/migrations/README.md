# Supabase Migration Sources (M1-01)

`docs/mvp/ddl/` を参照用の設計成果物、`supabase/migrations/` を適用用SQLとして扱う。
M1-01時点の対応は次の通り。

| 設計DDL | 適用migration |
| --- | --- |
| `docs/mvp/ddl/001_create_tables.sql` | `supabase/migrations/20260211190000_create_tables.sql` |
| `docs/mvp/ddl/002_create_indexes.sql` | `supabase/migrations/20260211190100_create_indexes.sql` |
| `docs/mvp/ddl/003_seed_initial_data.sql` | `supabase/migrations/20260211190200_seed_initial_data.sql` |

更新ルール:

1. `docs/mvp/ddl/` の変更時は、同一タスク内で `supabase/migrations/` へ反映する
2. 反映後は `docs/mvp/進捗管理シート_mvp.md` の該当タスクを更新する
