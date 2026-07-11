#!/usr/bin/env node
import "./bootstrap/env.js";
// Redirect stdout-breaking logs before any dependency imports (MCP uses stdio JSON-RPC).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _write = (msg: unknown, ...args: unknown[]) =>
  process.stderr.write(`${[msg, ...args].join(" ")}\n`);
console.log = _write;
console.info = _write;
console.debug = _write;

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as { version: string };

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerBlendCheckRatesTool } from "./tools/blend-check-rates.js";
import { registerCheckBalanceTool } from "./tools/check-balance.js";
import { registerGetAddressTool } from "./tools/get-address.js";
import { registerGetTreasuryStatusTool } from "./tools/get-treasury-status.js";
import { registerOptimizeTreasuryTool } from "./tools/optimize-treasury.js";
import { registerPingTool } from "./tools/ping.js";
import { registerRequestFundingTool } from "./tools/request-funding.js";
import { registerSetLiquidityThresholdTool } from "./tools/set-liquidity-threshold.js";
import { registerSpendingReportTool } from "./tools/spending-report.js";
import { registerTransferUsdcTool } from "./tools/transfer-usdc.js";
import { registerWalletDashboardTool } from "./tools/wallet-dashboard.js";
import { registerX402FetchTool } from "./tools/x402-fetch.js";
import { registerMppCloseSessionTool } from "./tools/mpp-close-session.js";
import { registerMppFetchTool } from "./tools/mpp-fetch.js";
import { registerMppOpenSessionTool } from "./tools/mpp-open-session.js";
import { registerMppStatusTool } from "./tools/mpp-status.js";
import { registerTransferXlmTool } from "./tools/transfer-xlm.js";
import { registerRegisterIdentityTool } from "./tools/register-identity.js";
import { registerGetMyReputationTool } from "./tools/get-my-reputation.js";
import { registerGetPolicyStatusTool } from "./tools/get-policy-status.js";
import { registerSetPolicyLimitsTool } from "./tools/set-policy-limits.js";
import { registerDeployPolicyTool } from "./tools/deploy-policy.js";
import { startTreasuryLoop } from "./treasury/rebalance.js";

const server = new McpServer({
  name: "nebula",
  version: pkg.version,
});

registerPingTool(server);
registerGetAddressTool(server);
registerCheckBalanceTool(server);
registerWalletDashboardTool(server);
registerRequestFundingTool(server);
registerTransferXlmTool(server);
registerTransferUsdcTool(server);
registerSpendingReportTool(server);
registerBlendCheckRatesTool(server);
registerGetTreasuryStatusTool(server);
registerSetLiquidityThresholdTool(server);
registerOptimizeTreasuryTool(server);
registerX402FetchTool(server);
registerMppOpenSessionTool(server);
registerMppStatusTool(server);
registerMppCloseSessionTool(server);
registerMppFetchTool(server);
registerRegisterIdentityTool(server);
registerGetMyReputationTool(server);
registerGetPolicyStatusTool(server);
registerSetPolicyLimitsTool(server);
registerDeployPolicyTool(server);

async function main(): Promise<void> {
  startTreasuryLoop();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Nebula MCP server failed to start:", error);
  process.exit(1);
});
