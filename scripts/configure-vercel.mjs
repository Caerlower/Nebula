import fs from "node:fs";
import path from "node:path";

const authPath = path.join(
  process.env.HOME ?? "",
  ".local/share/com.vercel.cli/auth.json",
);
const teamId = "team_qZq6suFAAmeS10A2vDey30Yd";
const projectName = "nebula-onchain";

if (!fs.existsSync(authPath)) {
  console.error("Vercel auth not found. Run: pnpm dlx vercel login");
  process.exit(1);
}

const { token } = JSON.parse(fs.readFileSync(authPath, "utf8"));

const response = await fetch(
  `https://api.vercel.com/v9/projects/${projectName}?teamId=${teamId}`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rootDirectory: "apps/web",
      framework: "tanstack-start",
      installCommand: "pnpm install",
      buildCommand: "pnpm build",
    }),
  },
);

const data = await response.json();

if (!response.ok) {
  console.error(data.error?.message ?? JSON.stringify(data));
  process.exit(1);
}

console.log("Vercel project configured:");
console.log(`  rootDirectory: ${data.rootDirectory}`);
console.log(`  framework: ${data.framework}`);
