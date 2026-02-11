#!/usr/bin/env bash

set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm command is required." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/site}"

OPENAPI_SPEC="${ROOT_DIR}/docs/mvp/openapi.yaml"
ASYNCAPI_SPEC="${ROOT_DIR}/docs/mvp/asyncapi.yaml"

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}/openapi"

pnpm --package=@redocly/cli@latest dlx redocly build-docs "${OPENAPI_SPEC}" --title "Mix Stud Online OpenAPI" -o "${OUTPUT_DIR}/openapi/index.html"
mkdir -p "${OUTPUT_DIR}/asyncapi"
cp "${ASYNCAPI_SPEC}" "${OUTPUT_DIR}/asyncapi/asyncapi.yaml"

cat > "${OUTPUT_DIR}/asyncapi/index.html" <<'HTML'
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mix Stud Online AsyncAPI</title>
    <script src="https://unpkg.com/@asyncapi/web-component@latest/lib/asyncapi-web-component.js"></script>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7fbff;
        color: #1f2a37;
      }

      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 20px 40px;
      }

      a {
        color: #0f6cc8;
      }

      .note {
        margin: 0 0 16px;
      }

      .frame {
        border: 1px solid #d6e2f0;
        border-radius: 12px;
        overflow: hidden;
        background: #fff;
      }

      asyncapi-component {
        height: calc(100vh - 180px);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>AsyncAPI Reference</h1>
      <p class="note">
        うまく表示されない場合は
        <a href="./asyncapi.yaml">asyncapi.yaml</a>
        を直接参照してください。
      </p>
      <div class="frame">
        <asyncapi-component
          schema-url="./asyncapi.yaml"
          config='{"show":{"errors":true}}'
        ></asyncapi-component>
      </div>
      <noscript>
        JavaScript が無効な環境では表示できません。<a href="./asyncapi.yaml">asyncapi.yaml</a> を参照してください。
      </noscript>
    </main>
  </body>
</html>
HTML

cat > "${OUTPUT_DIR}/index.html" <<'HTML'
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mix Stud Online API Reference</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --card-bg: #ffffff;
        --text: #1f2a37;
        --muted: #516176;
        --accent: #0f6cc8;
        --border: #d6e2f0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #eef4fc 0%, #f7fbff 100%);
        color: var(--text);
      }

      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 48px 20px 64px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 2rem;
      }

      p {
        margin: 0;
        color: var(--muted);
      }

      .grid {
        margin-top: 28px;
        display: grid;
        gap: 16px;
      }

      .card {
        display: block;
        padding: 18px 20px;
        border: 1px solid var(--border);
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        background: var(--card-bg);
      }

      .card:hover {
        border-color: #9fc4eb;
      }

      .title {
        color: var(--accent);
        font-weight: 700;
        margin-bottom: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Mix Stud Online API Reference</h1>
      <p>OpenAPI/AsyncAPI を GitHub Pages 上で閲覧するためのインデックスです。</p>
      <div class="grid">
        <a class="card" href="./openapi/">
          <div class="title">OpenAPI (HTTP API)</div>
          <div>docs/mvp/openapi.yaml から生成されたリファレンス</div>
        </a>
        <a class="card" href="./asyncapi/">
          <div class="title">AsyncAPI (WebSocket API)</div>
          <div>docs/mvp/asyncapi.yaml を HTML で可視化したリファレンス</div>
        </a>
      </div>
    </main>
  </body>
</html>
HTML

touch "${OUTPUT_DIR}/.nojekyll"
