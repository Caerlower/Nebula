import { ExplorerClient, NotFoundError } from "@trionlabs/stellar8004";

const address = process.argv[2];
if (!address) {
  console.error("Usage: node scripts/test-explorer.mjs <G...>");
  process.exit(1);
}

const client = new ExplorerClient("https://stellar8004.com");

try {
  const health = await client.health();
  console.log("health:", JSON.stringify(health, null, 2));
} catch (e) {
  console.error("health failed:", e);
}

try {
  const agents = await client.getAgentsByAddress(address);
  console.log("getAgentsByAddress:", JSON.stringify(agents, null, 2));
} catch (e) {
  console.error("getAgentsByAddress failed:", e);
  if (e instanceof NotFoundError) console.error("NotFoundError");
  if (e && typeof e === "object") {
    console.error("status:", e.status);
    console.error("body:", e.body);
  }
}
