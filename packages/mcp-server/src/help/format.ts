import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getNetworkConfig } from "../config.js";
import { isPolicyEnabled } from "../policy/config.js";
import { field, section } from "../lib/format-output.js";
import {
  HELP_CATEGORIES,
  HELP_ENV_VARS,
  HELP_QUICK_START,
  type HelpCategory,
  findHelpCategory,
} from "./catalog.js";
import { treasuryState } from "../treasury/state.js";

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version: string };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

function formatToolEntry(tool: {
  name: string;
  summary: string;
  params?: string;
  tip?: string;
}): string[] {
  const lines = [`  • ${tool.name}`, `    ${tool.summary}`];
  if (tool.params) {
    lines.push(`    Params: ${tool.params}`);
  }
  if (tool.tip) {
    lines.push(`    Tip: ${tool.tip}`);
  }
  return lines;
}

function formatRuntimeStatus(): string[] {
  const lines: string[] = [section("Your configuration")];

  try {
    const network = getNetworkConfig();
    lines.push(field("Network", network.name));
  } catch (error) {
    lines.push(
      field(
        "Network",
        error instanceof Error ? error.message : "invalid NETWORK env",
      ),
    );
  }

  lines.push(
    field("Wallet key", process.env.STELLAR_SECRET_KEY?.trim() ? "set" : "missing"),
    field(
      "Spending mode",
      isPolicyEnabled() ? "on-chain policy" : "off-chain limits",
    ),
  );

  if (isPolicyEnabled()) {
    lines.push(field("Policy contract", process.env.POLICY_CONTRACT_ID!.trim()));
  } else {
    const perCall = process.env.MAX_PER_CALL?.trim();
    const perDay = process.env.MAX_PER_DAY?.trim();
    lines.push(
      field("MAX_PER_CALL", perCall ?? "not set"),
      field("MAX_PER_DAY", perDay ?? "not set"),
    );
  }

  const threshold = treasuryState.getLiquidityThreshold();
  lines.push(
    field("Treasury asset", process.env.TREASURY_ASSET?.trim() || "xlm (default)"),
    field(
      "Liquidity threshold",
      threshold === null ? "not set" : String(threshold),
    ),
    field(
      "Rebalance interval",
      `${treasuryState.getRebalanceIntervalSeconds()}s`,
    ),
  );

  return lines;
}

export function formatHelp(options?: { category?: HelpCategory }): string {
  const version = readPackageVersion();
  const totalTools = HELP_CATEGORIES.reduce((n, g) => n + g.tools.length, 0);

  const lines: string[] = [
    `Nebula MCP · Help`,
    `Version: ${version} · ${totalTools} tools · Default network: testnet`,
    "",
    "Stellar wallet for AI agents — payments, treasury yield, spending policy, 8004 identity.",
  ];

  if (options?.category) {
    const group = findHelpCategory(options.category);
    if (!group) {
      return [
        ...lines,
        "",
        `Unknown category "${options.category}".`,
        `Valid categories: ${HELP_CATEGORIES.map((c) => c.id).join(", ")}`,
      ].join("\n");
    }

    lines.push(
      section(group.title),
      group.description,
      "",
      "Tools:",
      ...group.tools.flatMap(formatToolEntry),
    );
  } else {
    lines.push(
      section("Tool catalog"),
      "Call help with category to zoom in: wallet, transfers, limits, policy, x402, mpp, treasury, identity",
    );

    for (const group of HELP_CATEGORIES) {
      lines.push("", `▸ ${group.title} (${group.id})`, `  ${group.description}`);
      for (const tool of group.tools) {
        lines.push(`  • ${tool.name} — ${tool.summary}`);
      }
    }
  }

  lines.push(
    section("Environment variables"),
    "  Required:",
    ...HELP_ENV_VARS.filter((v) => v.required).map(
      (v) => `  • ${v.name} — ${v.purpose}`,
    ),
    "  Optional:",
    ...HELP_ENV_VARS.filter((v) => !v.required).map((v) => {
      const defaultLabel = v.defaultValue ? ` (default: ${v.defaultValue})` : "";
      return `  • ${v.name}${defaultLabel} — ${v.purpose}`;
    }),
    section("Quick start"),
    ...HELP_QUICK_START.map((prompt) => `  ${prompt}`),
    section("Docs"),
    field("Full reference", "TOOLS.md in the nebula-mcp package"),
    field("Install guide", "INSTALL.md"),
  );

  if (!options?.category) {
    lines.push(...formatRuntimeStatus());
  }

  return lines.join("\n").trim();
}
