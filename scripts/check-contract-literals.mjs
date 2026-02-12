import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TARGET_PATHS = ["apps", "packages"];
const EXCLUDED_PATH_PREFIXES = ["packages/shared/"];

const source = readFileSync("packages/shared/src/index.ts", "utf8");
const objectPattern =
  /export const\s+([A-Za-z0-9_]+)\s*=\s*\{([\s\S]*?)\}\s*as const;/g;
const propertyPattern = /([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/g;

/** @type {Map<string, Set<string>>} */
const rules = new Map();
let objectMatch;
while (true) {
  objectMatch = objectPattern.exec(source);
  if (objectMatch === null) {
    break;
  }

  const objectName = objectMatch[1];
  const objectBody = objectMatch[2];
  let propertyMatch;

  while (true) {
    propertyMatch = propertyPattern.exec(objectBody);
    if (propertyMatch === null) {
      break;
    }

    const key = propertyMatch[1];
    const literal = propertyMatch[2];
    if (!rules.has(literal)) {
      rules.set(literal, new Set());
    }
    rules.get(literal).add(`${objectName}.${key}`);
  }
}

/** @param {string} path */
const isExcludedPath = (path) =>
  EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

/** @param {string} dir */
const collectTargetFiles = (dir) => {
  /** @type {string[]} */
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const normalized = fullPath.replaceAll("\\", "/");
    if (isExcludedPath(normalized)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectTargetFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!normalized.endsWith(".ts") && !normalized.endsWith(".tsx")) {
      continue;
    }
    files.push(normalized);
  }

  return files;
};

const targetFiles = TARGET_PATHS.flatMap((path) => {
  if (!statSync(path).isDirectory()) {
    return [];
  }
  return collectTargetFiles(path);
});

/** @param {string} literal */
const findMatches = (literal) => {
  const needle = `"${literal}"`;
  /** @type {string[]} */
  const matches = [];

  for (const path of targetFiles) {
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.includes(needle)) {
        matches.push(`${path}:${index + 1}:${line}`);
      }
    }
  }

  return matches.join("\n");
};

let violations = 0;
console.log("[check-contract-literals] contract literals scan started");

for (const literal of [...rules.keys()].sort()) {
  const references = [...rules.get(literal)].sort().join(", ");
  const matches = findMatches(literal);

  if (matches.length === 0) {
    continue;
  }

  if (violations === 0) {
    console.log("\nDetected hard-coded contract literals:");
  }

  violations += 1;
  console.log(`\n- \"${literal}\" (use ${references})`);
  console.log(matches);
}

if (violations > 0) {
  console.log("\n[check-contract-literals] failed");
  process.exit(1);
}

console.log("[check-contract-literals] passed");
