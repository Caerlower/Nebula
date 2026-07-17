# nebulamcp-stdio

Local **stdio MCP** client for Claude Desktop, Cursor, and Claude Code. It runs via `npx` and forwards tool calls to the Nebula Hub over HTTP.

> **Private keys never leave the Hub.** This package only sends `NEBULA_TOKEN` to `NEBULA_HUB` — never a Stellar secret key.

The published CLI binaries are `nebulamcp` and `nebula`.

## Table of contents

- [Install](#install)
- [Environment](#environment)
- [Claude Desktop / Cursor](#claude-desktop--cursor)
- [Remote MCP (no stdio package)](#remote-mcp-no-stdio-package)

## Install

```bash
# In the monorepo (build core first)
pnpm --filter nebulamcp-core build
pnpm --filter nebulamcp-stdio build

# From npm (no install needed)
npx -y nebulamcp-stdio
```

> Publish order: `nebulamcp-core` first, then `nebulamcp-stdio`.

## Environment

| Variable       | Required | Description                                                              |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `NEBULA_TOKEN` | yes      | `nbl_live_…` from the Hub **Connect** page                               |
| `NEBULA_HUB`   | no       | Default `https://www.nebulaonchain.xyz` — use `http://localhost:3000` locally |

## Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebulamcp-stdio"],
      "env": {
        "NEBULA_TOKEN": "nbl_live_…",
        "NEBULA_HUB": "https://www.nebulaonchain.xyz"
      }
    }
  }
}
```

> Do **not** put `STELLAR_SECRET_KEY` here — only `NEBULA_TOKEN`.

## Remote MCP (no stdio package)

The Hub also speaks Streamable HTTP directly, for clients that can call HTTP (e.g. Claude Code):

```
POST https://www.nebulaonchain.xyz/mcp
Authorization: Bearer nbl_live_…
```

OAuth for hosted connectors: `/.well-known/oauth-authorization-server` → DCR `/api/oauth/register` → `/authorize` → `/oauth/token` (access tokens expire in 30 days).

More: [root README](../../README.md#connect-an-agent-mcp) · [docs/MCP-DEV.md](../../docs/MCP-DEV.md).
