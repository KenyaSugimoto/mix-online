-- ============================================================
-- Mix Stud Online MVP — インデックス定義
-- 参照: docs/mvp/詳細設計書_mvp.md §9.3
-- PostgreSQL 16+
-- ============================================================

-- 復元・再接続差分取得
CREATE INDEX idx_hand_events_table_seq
  ON hand_events (table_id, table_seq DESC);

-- 卓の最新ハンド取得
CREATE INDEX idx_hands_table_hand_no
  ON hands (table_id, hand_no DESC);

-- 履歴画面（ユーザーのハンド一覧）
CREATE INDEX idx_hand_players_user
  ON hand_players (user_id, hand_id DESC);

-- ロビー人数計算
CREATE INDEX idx_table_seats_status
  ON table_seats (table_id, status);

-- 監査（ウォレット履歴）
CREATE INDEX idx_wallet_tx_user_created
  ON wallet_transactions (user_id, created_at DESC);

-- 高速復元（スナップショット）
CREATE INDEX idx_table_snapshots_seq
  ON table_snapshots (table_id, table_seq DESC);

-- 履歴一覧ページング（endedAt DESC, handId DESC）
CREATE INDEX idx_hands_ended_at
  ON hands (ended_at DESC NULLS LAST, id DESC)
  WHERE ended_at IS NOT NULL;
