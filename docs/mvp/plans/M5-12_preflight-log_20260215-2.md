# M5-12 ローカル接続 preflight ログ

- 実行日時: 2026-02-15T04:56:46.397Z
- API Origin: http://localhost:3000
- Web Origin: http://localhost:5173
- Timeout(ms): 5000

| Check | Target | Result | Detail | Duration |
| --- | --- | --- | --- | --- |
| API health (direct) | http://localhost:3000/api/health | OK | HTTP 200 + status=ok | 31ms |
| API health (via web proxy) | http://localhost:5173/api/health | OK | HTTP 200 + status=ok | 18ms |
| WS (direct) | ws://localhost:3000/ws | OK | table.error AUTH_EXPIRED を受信 | 18ms |
| WS (via web proxy) | ws://localhost:5173/ws | OK | table.error AUTH_EXPIRED を受信 | 17ms |

注記: この preflight は接続経路（`/api`, `/ws`）の疎通確認です。M5-12 完了判定には手動2ユーザーで1ハンド終局と履歴反映の確認ログが別途必要です。
