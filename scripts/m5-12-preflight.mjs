import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_API_ORIGIN = "http://localhost:3000";
const DEFAULT_WEB_ORIGIN = "http://localhost:5173";
const DEFAULT_TIMEOUT_MS = 5000;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    apiOrigin: DEFAULT_API_ORIGIN,
    webOrigin: DEFAULT_WEB_ORIGIN,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    outputPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const next = args[index + 1];

    if (argument === "--") {
      continue;
    }

    if (argument === "--api-origin" && next) {
      parsed.apiOrigin = next;
      index += 1;
      continue;
    }
    if (argument === "--web-origin" && next) {
      parsed.webOrigin = next;
      index += 1;
      continue;
    }
    if (argument === "--timeout-ms" && next) {
      const timeoutMs = Number.parseInt(next, 10);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`--timeout-ms が不正です: ${next}`);
      }
      parsed.timeoutMs = timeoutMs;
      index += 1;
      continue;
    }
    if (argument === "--output" && next) {
      parsed.outputPath = next;
      index += 1;
      continue;
    }
    throw new Error(`不明な引数です: ${argument}`);
  }

  return parsed;
};

const toWsUrl = (origin, pathName = "/ws") => {
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = pathName;
  url.search = "";
  return url.toString();
};

const toHttpUrl = (origin, pathName) => {
  const url = new URL(origin);
  url.pathname = pathName;
  url.search = "";
  return url.toString();
};

const readMessageText = (data) => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  return String(data);
};

const toErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const runHttpCheck = async ({ name, url, timeoutMs, expectJsonStatusOk }) => {
  const startedAt = Date.now();
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(url, { signal: timeout });
    const elapsedMs = Date.now() - startedAt;

    if (response.status !== 200) {
      return {
        name,
        target: url,
        ok: false,
        detail: `HTTP ${response.status}`,
        elapsedMs,
      };
    }

    let detail = "HTTP 200";
    if (expectJsonStatusOk) {
      const body = await response.json();
      if (typeof body !== "object" || body === null || body.status !== "ok") {
        return {
          name,
          target: url,
          ok: false,
          detail: "JSON body.status が ok ではありません",
          elapsedMs,
        };
      }
      detail = "HTTP 200 + status=ok";
    }

    return {
      name,
      target: url,
      ok: true,
      detail,
      elapsedMs,
    };
  } catch (error) {
    return {
      name,
      target: url,
      ok: false,
      detail: toErrorMessage(error),
      elapsedMs: Date.now() - startedAt,
    };
  }
};

const runWsAuthExpiredCheck = ({ name, url, timeoutMs }) =>
  new Promise((resolveCheckResult) => {
    const startedAt = Date.now();
    let settled = false;

    const resolveOnce = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      resolveCheckResult({
        ...result,
        name,
        target: url,
        elapsedMs: Date.now() - startedAt,
      });
    };

    if (typeof WebSocket !== "function") {
      resolveOnce({
        ok: false,
        detail:
          "WebSocket API が利用できません（Node.js >= 22 を確認してください）",
      });
      return;
    }

    const socket = new WebSocket(url);
    const timerId = setTimeout(() => {
      socket.close();
      resolveOnce({
        ok: false,
        detail: `タイムアウト (${timeoutMs}ms)`,
      });
    }, timeoutMs);

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          type: "ping",
          requestId: randomUUID(),
          sentAt: new Date().toISOString(),
          payload: {},
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      clearTimeout(timerId);
      const messageText = readMessageText(event.data);
      socket.close();

      try {
        const parsed = JSON.parse(messageText);
        if (parsed?.type !== "table.error") {
          resolveOnce({
            ok: false,
            detail: `想定外メッセージ type=${String(parsed?.type)}`,
          });
          return;
        }
        if (parsed?.code !== "AUTH_EXPIRED") {
          resolveOnce({
            ok: false,
            detail: `table.error は受信したが code=${String(parsed?.code)}`,
          });
          return;
        }
        resolveOnce({
          ok: true,
          detail: "table.error AUTH_EXPIRED を受信",
        });
      } catch (error) {
        resolveOnce({
          ok: false,
          detail: `JSON parse 失敗: ${toErrorMessage(error)}`,
        });
      }
    });

    socket.addEventListener("error", () => {
      clearTimeout(timerId);
      resolveOnce({
        ok: false,
        detail: "WebSocket 通信エラー",
      });
    });

    socket.addEventListener("close", () => {
      if (settled) {
        return;
      }
      clearTimeout(timerId);
      resolveOnce({
        ok: false,
        detail: "メッセージ受信前に close されました",
      });
    });
  });

const renderMarkdown = ({ executedAt, inputs, results }) => {
  const lines = [];
  lines.push("# M5-12 ローカル接続 preflight ログ");
  lines.push("");
  lines.push(`- 実行日時: ${executedAt.toISOString()}`);
  lines.push(`- API Origin: ${inputs.apiOrigin}`);
  lines.push(`- Web Origin: ${inputs.webOrigin}`);
  lines.push(`- Timeout(ms): ${inputs.timeoutMs}`);
  lines.push("");
  lines.push("| Check | Target | Result | Detail | Duration |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const result of results) {
    lines.push(
      `| ${result.name} | ${result.target} | ${result.ok ? "OK" : "NG"} | ${result.detail} | ${result.elapsedMs}ms |`,
    );
  }
  lines.push("");
  lines.push(
    "注記: この preflight は接続経路（`/api`, `/ws`）の疎通確認です。M5-12 完了判定には手動2ユーザーで1ハンド終局と履歴反映の確認ログが別途必要です。",
  );
  lines.push("");
  return lines.join("\n");
};

const main = async () => {
  const args = parseArgs();
  const executedAt = new Date();

  const checks = [
    runHttpCheck({
      name: "API health (direct)",
      url: toHttpUrl(args.apiOrigin, "/api/health"),
      timeoutMs: args.timeoutMs,
      expectJsonStatusOk: true,
    }),
    runHttpCheck({
      name: "API health (via web proxy)",
      url: toHttpUrl(args.webOrigin, "/api/health"),
      timeoutMs: args.timeoutMs,
      expectJsonStatusOk: true,
    }),
    runWsAuthExpiredCheck({
      name: "WS (direct)",
      url: toWsUrl(args.apiOrigin),
      timeoutMs: args.timeoutMs,
    }),
    runWsAuthExpiredCheck({
      name: "WS (via web proxy)",
      url: toWsUrl(args.webOrigin),
      timeoutMs: args.timeoutMs,
    }),
  ];

  const results = await Promise.all(checks);
  const markdown = renderMarkdown({
    executedAt,
    inputs: args,
    results,
  });

  if (args.outputPath) {
    const outputPath = resolve(process.cwd(), args.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${markdown}`, "utf-8");
    console.log(`ログを出力しました: ${outputPath}`);
  }

  console.log(markdown);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
