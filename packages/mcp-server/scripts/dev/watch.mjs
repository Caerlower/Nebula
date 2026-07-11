import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env");

function loadEnvFile(path) {
  const env = { ...process.env };
  if (!existsSync(path)) {
    return env;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  return env;
}

const childEnv = loadEnvFile(envFile);

function run(command, args, label) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: childEnv,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.stderr.write(`[dev] ${label} stopped (${signal})\n`);
    } else if (code && code !== 0) {
      process.stderr.write(`[dev] ${label} exited with code ${code}\n`);
      shutdown(code ?? 1);
    }
  });

  return child;
}

let tsc;
let server;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  tsc?.kill("SIGTERM");
  server?.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

process.stderr.write("[dev] Building once before watch…\n");
execSync("pnpm exec tsc", { cwd: root, stdio: "inherit", env: childEnv });

tsc = run("pnpm", ["exec", "tsc", "-w", "--preserveWatchOutput"], "tsc");

if (existsSync(envFile)) {
  process.stderr.write(`[dev] Loaded env from ${envFile}\n`);
} else {
  process.stderr.write(
    "[dev] No .env found — copy packages/mcp-server/.env.example to .env\n",
  );
}

server = run(
  "node",
  ["--watch", "--watch-preserve-output", "dist/index.js"],
  "server",
);

process.stderr.write("[dev] MCP server watching dist/index.js\n");
