# nebulamcp

Local stdio MCP for Claude Desktop, Cursor, and Claude Code.

**Private keys never leave the Hub.** This package only sends `NEBULA_TOKEN` to `NEBULA_HUB`.

## Install

```bash
# monorepo
pnpm --filter nebulamcp-core build
pnpm --filter nebulamcp build

# when published (pnpm rewrites workspace:^ → ^0.1.0 on publish)
npx -y nebulamcp
```

Publish order: `nebulamcp-core` first, then `nebulamcp`.

The CLI binary is `nebula`.

## Env

| Variable | Required | Description |
|----------|----------|-------------|
| `NEBULA_TOKEN` | yes | `nbl_live_…` from the Hub Connect page |
| `NEBULA_HUB` | no | Default `https://www.nebulaonchain.xyz` — use `http://localhost:3000` locally |

## Claude Desktop

```json
{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebulamcp"],
      "env": {
        "NEBULA_TOKEN": "nbl_live_…",
        "NEBULA_HUB": "https://www.nebulaonchain.xyz"
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
