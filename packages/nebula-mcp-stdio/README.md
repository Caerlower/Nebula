# @nebula/mcp

Local stdio MCP for Claude Desktop, Cursor, and Claude Code.

**Private keys never leave the Hub.** This package only sends `NEBULA_TOKEN` to `NEBULA_HUB`.

## Install

```bash
# monorepo
pnpm --filter @nebula/core build
pnpm --filter @nebula/mcp build

# when published (pnpm rewrites workspace:^ → ^0.1.0 on publish)
npx -y @nebula/mcp
```

Publish order: `@nebula/core` first, then `@nebula/mcp`.

The CLI binary is `nebula`.

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `NEBULA_TOKEN` | yes | `nbl_live_…` from the Hub Connect page |
| `NEBULA_HUB` | no | Default `https://nebulaonchain.xyz` — use `http://localhost:3000` locally |

## Claude Desktop

```json
{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "@nebula/mcp"],
      "env": {
        "NEBULA_TOKEN": "nbl_live_…",
        "NEBULA_HUB": "http://localhost:3000"
      }
    }
  }
}
```

Do **not** put `STELLAR_SECRET_KEY` here.

## Remote MCP (no stdio package)

Hub also speaks Streamable HTTP:

```
POST http://localhost:3000/mcp
Authorization: Bearer nbl_live_…
```

OAuth for hosted connectors: `/.well-known/oauth-authorization-server` → DCR `/api/oauth/register` → `/authorize` → `/oauth/token` (access tokens expire in 30 days).
