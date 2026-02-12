import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TARGET_PATHS = ["apps", "packages"];
const FILE_GLOBS = ["--glob", "*.ts", "--glob", "*.tsx"];
const EXCLUDE_GLOBS = ["--glob", "!packages/shared/**"];

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

/** @param {string} literal */
const findMatches = (literal) => {
  const result = spawnSync(
    "rg",
    [
      "-n",
      "--fixed-strings",
      ...FILE_GLOBS,
      ...EXCLUDE_GLOBS,
      `"${literal}"`,
      ...TARGET_PATHS,
    ],
    { encoding: "utf8" },
  );

  if (result.status === 0) {
    return result.stdout.trim();
  }

  if (result.status === 1) {
    return "";
  }

  const stderr = result.stderr?.trim() ?? "";
  throw new Error(`rg failed for literal \"${literal}\": ${stderr}`);
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
