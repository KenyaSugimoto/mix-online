-- ============================================================
-- Mix Stud Online MVP — テーブル定義
-- 参照: docs/mvp/詳細設計書_mvp.md §9
-- PostgreSQL 16+
-- ============================================================

-- ----------------------------------------------------------
-- 1. users — プレイヤー
-- ----------------------------------------------------------
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub    text        NOT NULL UNIQUE,
  display_name  text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- 2. wallets — プレイマネー残高
-- ----------------------------------------------------------
CREATE TABLE wallets (
  user_id     uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- 3. wallet_transactions — ウォレット変動履歴（監査用）
-- ----------------------------------------------------------
CREATE TABLE wallet_transactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN ('INIT_GRANT', 'BUY_IN', 'CASH_OUT', 'HAND_RESULT')),
  amount        integer     NOT NULL,
  balance_after integer     NOT NULL CHECK (balance_after >= 0),
  hand_id       uuid,       -- HAND_RESULT 時のみ設定。FK は hands 作成後に追加
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- 4. tables — 卓設定
-- ----------------------------------------------------------
CREATE TABLE tables (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  small_bet             integer     NOT NULL DEFAULT 20,
  big_bet               integer     NOT NULL DEFAULT 40,
  ante                  integer     NOT NULL DEFAULT 5,
  bring_in              integer     NOT NULL DEFAULT 10,
  max_players           integer     NOT NULL DEFAULT 6  CHECK (max_players BETWEEN 2 AND 6),
  min_players           integer     NOT NULL DEFAULT 2  CHECK (min_players BETWEEN 2 AND 6),
  mix_index             integer     NOT NULL DEFAULT 0  CHECK (mix_index BETWEEN 0 AND 2),
  hands_since_rotation  integer     NOT NULL DEFAULT 0  CHECK (hands_since_rotation BETWEEN 0 AND 5),
  dealer_seat           integer     NOT NULL DEFAULT 1  CHECK (dealer_seat BETWEEN 1 AND 6),
  status                text        NOT NULL DEFAULT 'WAITING'
                                    CHECK (status IN ('WAITING', 'DEALING', 'BETTING', 'SHOWDOWN', 'HAND_END'))
);

-- ----------------------------------------------------------
-- 5. table_seats — 卓内座席
-- ----------------------------------------------------------
CREATE TABLE table_seats (
  table_id          uuid        NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  seat_no           integer     NOT NULL CHECK (seat_no BETWEEN 1 AND 6),
  user_id           uuid        REFERENCES users(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'EMPTY'
                                CHECK (status IN ('EMPTY', 'SEATED_WAIT_NEXT_HAND', 'ACTIVE', 'SIT_OUT', 'DISCONNECTED', 'LEAVE_PENDING')),
  stack             integer     NOT NULL DEFAULT 0 CHECK (stack >= 0),
  disconnect_streak integer     NOT NULL DEFAULT 0 CHECK (disconnect_streak >= 0),
  joined_at         timestamptz,
  PRIMARY KEY (table_id, seat_no)
);

-- 同一卓に同一ユーザーは1席のみ
CREATE UNIQUE INDEX uq_table_seats_user
  ON table_seats (table_id, user_id)
  WHERE user_id IS NOT NULL;

-- ----------------------------------------------------------
-- 6. hands — ハンド（1配札〜精算の単位）
-- ----------------------------------------------------------
CREATE TABLE hands (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        uuid        NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  hand_no         bigint      NOT NULL,
  game_type       text        NOT NULL CHECK (game_type IN ('STUD_HI', 'RAZZ', 'STUD_8')),
  status          text        NOT NULL DEFAULT 'IN_PROGRESS'
                              CHECK (status IN ('IN_PROGRESS', 'SHOWDOWN', 'HAND_END')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  winner_summary  jsonb,
  deck_hash       text        NOT NULL
);

-- ----------------------------------------------------------
-- 7. hand_players — ハンド参加プレイヤーのスナップショット
-- ----------------------------------------------------------
CREATE TABLE hand_players (
  hand_id      uuid    NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  user_id      uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_no      integer NOT NULL CHECK (seat_no BETWEEN 1 AND 6),
  start_stack  integer NOT NULL CHECK (start_stack >= 0),
  end_stack    integer          CHECK (end_stack >= 0),
  result_delta integer,
  cards_up     jsonb   NOT NULL DEFAULT '[]'::jsonb,
  cards_down   jsonb   NOT NULL DEFAULT '[]'::jsonb,
  state        text    NOT NULL DEFAULT 'IN_HAND'
                       CHECK (state IN ('IN_HAND', 'FOLDED', 'ALL_IN', 'AUTO_FOLDED')),
  PRIMARY KEY (hand_id, user_id)
);

-- ----------------------------------------------------------
-- 8. hand_events — ゲーム進行イベントログ
-- ----------------------------------------------------------
CREATE TABLE hand_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id     uuid        NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  table_id    uuid        NOT NULL,
  table_seq   bigint      NOT NULL,
  hand_seq    bigint      NOT NULL,
  event_name  text        NOT NULL CHECK (event_name IN (
                'DealInitEvent', 'DealCards3rdEvent', 'DealCardEvent',
                'PostAnteEvent', 'BringInEvent', 'CompleteEvent',
                'BetEvent', 'RaiseEvent', 'CallEvent', 'CheckEvent', 'FoldEvent',
                'StreetAdvanceEvent', 'ShowdownEvent', 'DealEndEvent',
                'SeatStateChangedEvent', 'PlayerDisconnectedEvent', 'PlayerReconnectedEvent'
              )),
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, table_seq),
  UNIQUE (hand_id, hand_seq)
);

-- ----------------------------------------------------------
-- 9. hand_results — ポットごとの精算結果
-- ----------------------------------------------------------
CREATE TABLE hand_results (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  hand_id         uuid    NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  pot_no          integer NOT NULL CHECK (pot_no >= 1),
  side            text    NOT NULL CHECK (side IN ('HI', 'LO', 'SINGLE')),
  winner_user_id  uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          integer NOT NULL CHECK (amount >= 0)
);

-- ----------------------------------------------------------
-- 10. table_snapshots — 再接続用スナップショット
-- ----------------------------------------------------------
CREATE TABLE table_snapshots (
  table_id    uuid        PRIMARY KEY REFERENCES tables(id) ON DELETE CASCADE,
  table_seq   bigint      NOT NULL,
  payload     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- wallet_transactions.hand_id への遅延FK追加
-- ----------------------------------------------------------
ALTER TABLE wallet_transactions
  ADD CONSTRAINT fk_wallet_transactions_hand
  FOREIGN KEY (hand_id) REFERENCES hands(id) ON DELETE SET NULL;
