# Nebula MCP Server

Stage 2: read-only Stellar wallet on testnet (`get_address`, `check_balance`).

## Versions

| Package | Version | Notes |
|---------|---------|-------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | v1 API — `McpServer` + `StdioServerTransport` |
| `@stellar/stellar-sdk` | ^16.0.1 | `Keypair.fromSecret()`, `Horizon.Server.loadAccount()` for balances |
| `zod` | ^3.25.0 | MCP SDK peer dependency |
| Node.js | >=18 | Required |

**Stellar SDK usage (v16):** RPC `getAccount()` only returns sequence data for transaction building. For full balance lists (XLM + trustlines), this server uses **Horizon** `loadAccount()` — the current recommended pattern for read-only classic account balances.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_SECRET_KEY` | Yes (for wallet tools) | — | Stellar secret key (`S...`). Never commit this. |
| `NETWORK` | No | `testnet` | `testnet` or `mainnet` |

If `STELLAR_SECRET_KEY` is missing or invalid, wallet tools return a readable error — the server keeps running.

## Build and run

From the repo root:

```bash
pnpm install
pnpm --filter nebula-mcp-server build
STELLAR_SECRET_KEY="S..." NETWORK=testnet pnpm --filter nebula-mcp-server start
```

Development:

```bash
STELLAR_SECRET_KEY="S..." NETWORK=testnet pnpm --filter nebula-mcp-server dev
```

## Fund a testnet account (Friendbot)

1. Generate a keypair (one-time):

```bash
node -e "const {Keypair}=require('@stellar/stellar-sdk'); const k=Keypair.random(); console.log('SECRET:', k.secret()); console.log('PUBLIC:', k.publicKey());"
```

2. Set `STELLAR_SECRET_KEY` to the `S...` value.

3. Fund via Friendbot (replace `G...` with your public key):

```bash
curl "https://friendbot.stellar.org?addr=GYOUR_PUBLIC_KEY_HERE"
```

Or open in a browser:

```
https://friendbot.stellar.org?addr=GYOUR_PUBLIC_KEY_HERE
```

Friendbot sends 10,000 test XLM. Only works on **testnet**.

## Connect to Claude Code (terminal)

After building, re-add the server with env vars:

```bash
pnpm --filter nebula-mcp-server build

claude mcp remove nebula 2>/dev/null; claude mcp add nebula \
  --env STELLAR_SECRET_KEY="SYOUR_SECRET_KEY" \
  --env NETWORK=testnet \
  -- node /Users/manavgoyal/Nebula/packages/mcp-server/dist/index.js
```

Restart Claude Code, then test:

- *"Use get_address from Nebula"*
- *"Use check_balance from Nebula"*

## Connect to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nebula": {
      "command": "node",
      "args": [
        "/Users/manavgoyal/Nebula/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "STELLAR_SECRET_KEY": "SYOUR_SECRET_KEY",
        "NETWORK": "testnet"
      }
    }
  }
}
```

Quit Claude Desktop completely (Cmd+Q), reopen, and test the tools.

## Tools

| Tool | Description |
|------|-------------|
| `ping` | Health check |
| `get_address` | Public Stellar address (`G...`) |
| `check_balance` | XLM + asset balances (or Friendbot instructions if unfunded) |

## Test with MCP Inspector (optional)

```bash
STELLAR_SECRET_KEY="S..." NETWORK=testnet \
  npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js
```
