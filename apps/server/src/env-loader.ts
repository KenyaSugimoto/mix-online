import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_ENV_FILENAMES = [".env.local", ".env"] as const;
const EXPORT_PREFIX = "export ";

const parseEnvValue = (rawValue: string) => {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    const unquoted = rawValue.slice(1, -1);
    return unquoted
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
};

const parseEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith(EXPORT_PREFIX)
    ? trimmed.slice(EXPORT_PREFIX.length).trim()
    : trimmed;
  const separatorIndex = normalized.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const rawValue = normalized.slice(separatorIndex + 1).trim();
  return {
    key,
    value: parseEnvValue(rawValue),
  };
};

export const loadServerEnv = (params?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  fileNames?: readonly string[];
}) => {
  const cwd = params?.cwd ?? process.cwd();
  const env = params?.env ?? process.env;
  const fileNames = params?.fileNames ?? DEFAULT_ENV_FILENAMES;
  const loadedFiles: string[] = [];

  for (const fileName of fileNames) {
    const filePath = resolve(cwd, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      if (env[parsed.key] !== undefined) {
        continue;
      }
      env[parsed.key] = parsed.value;
    }

    loadedFiles.push(filePath);
  }

  return { loadedFiles };
};
