import fs from "node:fs";
import path from "node:path";
import { getSafeRuntimeStatus, type SafeRuntimeStatus } from "@/lib/constants";

const DOT_ENV_PATH = path.join(process.cwd(), ".env");
const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

let cachedDotMtime = -1;
let cachedLocalMtime = -1;
let cachedParsedFileVars: Record<string, string> = {};

function parseEnvFileInto(filePath: string, target: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) {
      target[key] = value;
    }
  }
}

/**
 * Loads variables from .env and .env.local with fast mtime caching so page navigations
 * never block on repeated disk reads, while still picking up edits immediately.
 */
export function getEffectiveEnv(): Record<string, string | undefined> {
  try {
    const dotMtime = fs.existsSync(DOT_ENV_PATH)
      ? fs.statSync(DOT_ENV_PATH).mtimeMs
      : 0;
    const localMtime = fs.existsSync(ENV_LOCAL_PATH)
      ? fs.statSync(ENV_LOCAL_PATH).mtimeMs
      : 0;

    if (dotMtime !== cachedDotMtime || localMtime !== cachedLocalMtime) {
      const nextVars: Record<string, string> = {};
      parseEnvFileInto(DOT_ENV_PATH, nextVars);
      parseEnvFileInto(ENV_LOCAL_PATH, nextVars);
      cachedParsedFileVars = nextVars;
      cachedDotMtime = dotMtime;
      cachedLocalMtime = localMtime;
    }
  } catch {
    // Ignore stat/read errors on read-only serverless containers
  }

  return { ...process.env, ...cachedParsedFileVars };
}

export function getEffectiveRuntimeStatus(): SafeRuntimeStatus {
  return getSafeRuntimeStatus(getEffectiveEnv());
}

export function updateLocalServerEnv(
  updates: Record<string, string | undefined>
): void {
  if (process.env.VERCEL) {
    throw new Error(
      "Environment variables on Vercel must be configured in your Vercel Project Settings."
    );
  }

  const targetPath = fs.existsSync(ENV_LOCAL_PATH)
    ? ENV_LOCAL_PATH
    : DOT_ENV_PATH;

  let existingLines: string[] = [];
  if (fs.existsSync(targetPath)) {
    existingLines = fs.readFileSync(targetPath, "utf8").split(/\r?\n/);
  }

  const updatedKeys = new Set<string>();
  const nextLines = existingLines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) return line;
    const key = trimmed.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      updatedKeys.add(key);
      const val = updates[key] ?? "";
      process.env[key] = val;
      return `${key}="${val.replace(/"/g, '\\"')}"`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (updatedKeys.has(key) || value === undefined) continue;
    process.env[key] = value;
    nextLines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
  }

  const content =
    nextLines
      .filter((l, i, arr) => !(i === arr.length - 1 && l === ""))
      .join("\n") + "\n";
  fs.writeFileSync(targetPath, content, { encoding: "utf8" });
  cachedDotMtime = -1;
  cachedLocalMtime = -1;
}
