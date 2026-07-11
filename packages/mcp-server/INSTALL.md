# Install Nebula MCP

Three ways to connect Nebula to Claude — pick one.

## Option A — npx (recommended, like Pixa)

Published on npm as **`nebula-mcp`**. Add to your MCP config:

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Claude Code** — project `.mcp.json` or global MCP settings

```json
{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebula-mcp"],
      "env": {
        "STELLAR_SECRET_KEY": "S...",
        "NETWORK": "testnet",
        "MAX_PER_CALL": "1000",
        "MAX_PER_DAY": "10000",
        "POLICY_CONTRACT_ID": "",
        "TREASURY_ASSET": "xlm",
        "LIQUIDITY_THRESHOLD": "10",
        "REBALANCE_INTERVAL_SECONDS": "60",
        "MPP_RECIPIENT": ""
      }
    }
  }
}
```

Copy from [`mcp.example.json`](./mcp.example.json), set your secret key, restart Claude.

No clone, no build step — `npx` downloads and runs the server.

## Option B — Claude Desktop one-click (`.mcpb`)

For non-developers — like Pixa's `pixa.mcpb`:

```bash
pnpm --filter nebula-mcp build:mcpb
```

Double-click `packages/mcp-server/nebula.mcpb`. Enter your Stellar secret key in the install wizard.

## Option C — Monorepo / local dev

From this repository after building:

```bash
pnpm install
pnpm --filter nebula-mcp build
```

Use the repo root [`.mcp.json`](../../.mcp.json) (points at `packages/mcp-server/dist/index.js`) or:

```bash
claude mcp add nebula \
  -e STELLAR_SECRET_KEY="S..." \
  -e NETWORK=testnet \
  -e POLICY_CONTRACT_ID="C..." \
  -e MAX_PER_CALL=1000 \
  -e MAX_PER_DAY=10000 \
  -e TREASURY_ASSET=xlm \
  -e LIQUIDITY_THRESHOLD=10 \
  -- node "$(pwd)/packages/mcp-server/dist/index.js"
```

## Option D — Link locally (test before publish)

```bash
pnpm --filter nebula-mcp build
cd packages/mcp-server && npm link
```

Then use `"command": "nebula-mcp"` in your MCP config (no npx).

---

Restart Claude after changing MCP config.

## First steps in chat

```
Use wallet_dashboard from Nebula
Use request_funding from Nebula
Use check_balance from Nebula
```

`wallet_dashboard` renders an **interactive UI inside chat** (MCP Apps — Claude Desktop / supported hosts).

## Required env vars

| Variable | Required | Notes |
|----------|----------|-------|
| `STELLAR_SECRET_KEY` | Yes | Stellar secret key (S...) |
| `NETWORK` | No | `testnet` (default) or `mainnet` |
| `POLICY_CONTRACT_ID` | No | On-chain policy (C...) — replaces off-chain limits |
| `MAX_PER_CALL` / `MAX_PER_DAY` | Off-chain only | Required when policy contract unset |

See [README.md](./README.md) for the full tool list and capabilities reference.

Full parameter docs: **[TOOLS.md](./TOOLS.md)**

## Publish to npm (maintainers)

```bash
pnpm --filter nebula-mcp build
cd packages/mcp-server
npm login
npm publish --access public
```

`prepack` runs build + strips `.d.ts` / source maps from the tarball automatically.

After publish, users install with:

```bash
npx -y nebula-mcp
```
