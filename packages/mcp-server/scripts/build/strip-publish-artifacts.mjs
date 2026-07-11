import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../../dist", import.meta.url));

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (
      name.endsWith(".d.ts") ||
      name.endsWith(".d.ts.map") ||
      name.endsWith(".js.map") ||
      name === "view.js"
    ) {
      rmSync(path);
    }
  }
}

walk(dist);
console.log("Stripped publish artifacts from dist/");
