import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServerEnv } from "../../env-loader";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "mix-online-env-loader-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("サーバー環境変数ローダー", () => {
  it(".env.local と .env を順に読み込み、既存値を上書きしない", () => {
    const tempDir = createTempDir();
    writeFileSync(
      join(tempDir, ".env.local"),
      [
        "GOOGLE_OAUTH_CLIENT_ID=local-client-id",
        "WEB_CLIENT_ORIGIN=http://localhost:5173",
        "COMMON_VALUE=from-local",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      join(tempDir, ".env"),
      ["GOOGLE_OAUTH_SCOPE=openid email profile", "COMMON_VALUE=from-env"].join(
        "\n",
      ),
      "utf-8",
    );

    const env: NodeJS.ProcessEnv = {
      GOOGLE_OAUTH_CLIENT_ID: "already-set-client-id",
    };
    const result = loadServerEnv({ cwd: tempDir, env });

    expect(result.loadedFiles).toHaveLength(2);
    expect(env.GOOGLE_OAUTH_CLIENT_ID).toBe("already-set-client-id");
    expect(env.WEB_CLIENT_ORIGIN).toBe("http://localhost:5173");
    expect(env.GOOGLE_OAUTH_SCOPE).toBe("openid email profile");
    expect(env.COMMON_VALUE).toBe("from-local");
  });

  it("export 記法とクォート値を読み込む", () => {
    const tempDir = createTempDir();
    writeFileSync(
      join(tempDir, ".env.local"),
      [
        'export OAUTH_SCOPE="openid email profile"',
        "WEB_CLIENT_ORIGIN='http://localhost:5173'",
        "INVALID-KEY=should-be-ignored",
      ].join("\n"),
      "utf-8",
    );

    const env: NodeJS.ProcessEnv = {};
    loadServerEnv({ cwd: tempDir, env });

    expect(env.OAUTH_SCOPE).toBe("openid email profile");
    expect(env.WEB_CLIENT_ORIGIN).toBe("http://localhost:5173");
    expect(env["INVALID-KEY"]).toBeUndefined();
  });
});
