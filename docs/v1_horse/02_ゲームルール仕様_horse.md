# Mix Online v1 ゲームルール仕様（HORSE）

> 作成日: 2026-02-13 ｜ 対象バージョン: v1 ｜ ステータス: Draft

## 1. 目的

HORSE 5種に対して、実装・テストが同じ判定基準を参照できる仕様を定義する。

## 2. 共通ルール

- 形式はすべて `FIXED_LIMIT`。
- 席数は 2〜6 を想定。
- タイムアウト時の自動行動、切断時の扱いは MVP 原則を継承。
- odd chip 処理は既存方針を継続。
- 4th street open pair による big bet 選択ルールは不採用。

### ゲーム種別ごとの強制ベット適用

| ゲーム  | Ante | Bring-in | SB                | BB              |
| ------- | ---- | -------- | ----------------- | --------------- |
| HOLD_EM | なし | なし     | $10（smallBet/2） | $20（smallBet） |
| OMAHA_8 | なし | なし     | $10（smallBet/2） | $20（smallBet） |
| RAZZ    | $5   | $10      | なし              | なし            |
| STUD_HI | $5   | $10      | なし              | なし            |
| STUD_8  | $5   | $10      | なし              | なし            |

## 3. ゲーム別仕様

### 3.1 HOLD_EM（Limit Hold'em）

- 初期配札: 各プレイヤー hole 2枚（非公開）。`DealHoleCardsEvent` で配布。
- 強制ベット: SB（$10）→ BB（$20）。Ante/Bring-in は不使用。
- Street: `PRE_FLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN`。
- Board: FLOP 3枚、TURN 1枚、RIVER 1枚。
- ベットサイズ:
  - PRE_FLOP/FLOP は small bet 単位。
  - TURN/RIVER は big bet 単位。

### 3.2 OMAHA_8（Limit Omaha Hi-Lo 8 or Better）

- 初期配札: 各プレイヤー hole 4枚（非公開）。`DealHoleCardsEvent` で配布。
- 強制ベット: SB（$10）→ BB（$20）。Ante/Bring-in は不使用。
- Street 構成は Hold'em と同じ。
- ハンド作成: hole から必ず2枚、board から必ず3枚を使用。
- Lo 成立条件: 8以下で重複なし 5枚。

### 3.3 RAZZ

- 初期配札: 3rd で 3枚（down/down/up）。
- Street: `THIRD -> FOURTH -> FIFTH -> SIXTH -> SEVENTH -> SHOWDOWN`。
- Bring-in: 3rd の up card が最も強いプレイヤー（Razz では強い = Lo 的に悪い）：
  1. ランク昇順（K > Q > ... > 2 > A）→ K vs A の場合は K が Bring-in
  2. スート（クラブ > ダイヤ > ハート > スペード）→ Ks vs Kh の場合は Ks が Bring-in
- First-to-act: Bring-in の左隣から時計回り。

### 3.4 STUD_HI

- 初期配札: 3rd で 3枚（down/down/up）。
- Street は RAZZ と同じ。
- Bring-in: 3rd の up card が最も弱いプレイヤー：
  1. ランク昇順（2 < 3 < ... < K < A）→ 2 vs A の場合は 2 が Bring-in
  2. スート（クラブ < ダイヤ < ハート < スペード）→ 2c vs 2d の場合は 2c が Bring-in
- First-to-act: Bring-in の左隣から時計回り。

### 3.5 STUD_8

- Street/配札/Bring-in は Stud Hi と同様。
- 勝敗は Hi/Lo split。Lo 成立条件は 8-or-better。

## 4. First-to-act ルール

### 4.1 Stud 系（RAZZ, STUD_HI, STUD_8）

- 3rd Street: Bring-in 担当プレイヤーの左隣から時計回り。
- 4th〜7th Street: 公開カードが最も強い（RAZZ は最弱）プレイヤーから。

### 4.2 Flop 系（HOLD_EM, OMAHA_8）

- PRE_FLOP: BB の左隣（UTG）から時計回り。
- FLOP / TURN / RIVER: ディーラーの左隣（SB存続ならSB）から時計回り。

## 5. アクション合法性

- 共通: `FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`。
- Stud 系 3rd の bring-in 局面では `BRING_IN` / `COMPLETE` を許可。
- 4th 以降は `COMPLETE` 不可。
- レイズ回数 cap は MVP の上限方針を継承（ゲーム非依存）。

## 6. Showdown / Pot 分配

- High-only ゲーム: 最強 High hand が獲得。
- Low-only ゲーム（RAZZ）: 最強 Low hand が獲得。
- Hi/Lo ゲーム: pot 単位で High/Low 独立評価。
- Low 不成立時: High 総取り。

## 7. 実装メモ

- `GameRule` は以下インターフェースを最低限満たす:
  - street progression
  - legal action resolver
  - hand evaluator
  - showdown payout resolver
- Stud 系と Flop 系で共通抽象を分離する:
  - card dealing policy
  - first-to-act policy
  - visible card projection policy

## 8. テスト観点

- ルールごとの正常進行。
- bring-in/first-to-act の境界値。
- Hi/Lo 片側不成立。
- odd chip 分配。
- side pot 多段構成。
- Omaha8: hole 4枚から必ず2枚、board 5枚から必ず3枚の制約違反検証。
- Omaha8 と Hold'em のハンド構成差（任意5枚 vs 2+3固定）による評価結果の差分。
- Flop 系 PRE_FLOP first-to-act（UTG）と POST_FLOP first-to-act（SB位置）の切替。
