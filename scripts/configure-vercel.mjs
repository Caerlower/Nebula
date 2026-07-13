import fs from "node:fs";
import path from "node:path";

const authCandidates = [
  path.join(process.env.HOME ?? "", ".local/share/com.vercel.cli/auth.json"),
  path.join(
    process.env.HOME ?? "",
    "Library/Application Support/com.vercel.cli/auth.json",
  ),
  path.join(process.env.HOME ?? "", ".config/com.vercel.cli/auth.json"),
];

const authPath = authCandidates.find((candidate) => fs.existsSync(candidate));
const teamId = "team_qZq6suFAAmeS10A2vDey30Yd";
const projectName = "nebula-onchain";

if (!authPath) {
  console.error(
    "Vercel auth not found. Run: pnpm dlx vercel login",
  );
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
      rootDirectory: "apps/nebula-hub",
      framework: "nextjs",
      installCommand: "cd ../.. && pnpm install",
      buildCommand: "cd ../.. && pnpm build:site",
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
console.log(`  installCommand: ${data.installCommand}`);
console.log(`  buildCommand: ${data.buildCommand}`);
