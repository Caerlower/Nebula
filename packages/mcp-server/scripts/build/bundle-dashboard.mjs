import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const templatePath = join(root, "src/apps/dashboard/template.html");
const outDir = join(root, "dist/apps");
const outHtml = join(outDir, "dashboard.html");

async function main() {
  const bundle = await esbuild.build({
    entryPoints: [join(root, "src/apps/dashboard/view.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
  });

  const js = bundle.outputFiles[0]?.text;
  if (!js) {
    throw new Error("Dashboard bundle produced no output.");
  }

  const template = readFileSync(templatePath, "utf8");
  const html = template.replace(
    "<!--NEBULA_DASHBOARD_SCRIPT-->",
    `<script>${js}</script>`,
  );

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outHtml, html, "utf8");
  console.error(`Bundled dashboard UI → ${outHtml} (${html.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
