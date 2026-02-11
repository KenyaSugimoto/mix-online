# Mix Stud Online APIリファレンス閲覧ガイド（MVP）

Version: v1.0  
Last Updated: 2026-02-11  
関連仕様: [`openapi.yaml`](./openapi.yaml), [`asyncapi.yaml`](./asyncapi.yaml)  
実装ガイド: [`実装推進ガイド_mvp.md`](./実装推進ガイド_mvp.md)

---

## 1. 目的

- GitHubブラウザ上で `openapi.yaml` / `asyncapi.yaml` を直接読む負荷を下げる。
- OpenAPIのHTMLリファレンスを自動更新し、手動PDF更新を不要にする。
- AsyncAPIは当面 `asyncapi.yaml` へのブラウザ向け導線を提供する。

---

## 2. 公開先（GitHub Pages）

- Top: <https://kenyasugimoto.github.io/mix-online/>
- OpenAPI: <https://kenyasugimoto.github.io/mix-online/openapi/>
- AsyncAPI: <https://kenyasugimoto.github.io/mix-online/asyncapi/>

補足:

- `openapi/` は `openapi.yaml` から生成されたHTMLリファレンス
- `asyncapi/` は `asyncapi.yaml` 参照ページ（暫定運用）

※ GitHub Pages が未有効な場合は、リポジトリ設定で `GitHub Actions` をソースに設定する。

---

## 3. 更新タイミング

- `main` ブランチへ push されるたびに `.github/workflows/docs-pages.yml` が実行される。
- 対象パス:
  - `docs/mvp/**`
  - `scripts/build-api-reference-site.sh`
  - `.github/workflows/docs-pages.yml`

---

## 4. ローカル確認手順

1. `pnpm docs:api:build` を実行する。
2. `site/index.html` をブラウザで開く。

---

## 5. 運用ルール

- API仕様の正本は従来どおり `docs/mvp/openapi.yaml` / `docs/mvp/asyncapi.yaml` とする。
- HTMLは配布物であり、Git管理対象には含めない（Workflowで都度生成）。
