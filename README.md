# Nebula

**A Stellar wallet for AI agents** — custody, policy, and payments so agents can spend USDC on-chain without holding private keys.

Production: [nebulaonchain.xyz](https://nebulaonchain.xyz)

---

## Architecture

Private keys never leave the Hub. Agents and MCP clients only present a `nbl_live_…` token (or OAuth). The Hub enforces policy, confirms transfers when required, signs with Privy, and submits to Stellar.

```mermaid
flowchart TB
  subgraph clients [Clients]
    CD[Claude Desktop / Cursor]
    CC[Claude Code]
    RM[Remote MCP / OAuth]
  end

  subgraph npm [MCP package]
    STDIO["nebulamcp<br/>stdio → Hub HTTP"]
  end

  subgraph hub [Nebula Hub — apps/nebula-hub]
    UI[Dashboard · Policy · Approvals · Connect]
    API["/api/tools/* · /api/wallet · /api/agents"]
    MCP["POST /mcp · OAuth DCR"]
    PIPE[Tool pipeline + confirmations]
    PRIVY[Privy embedded Stellar wallet]
  end

  subgraph chain [Stellar]
    POL[Policy contract]
    NET[Payments · x402 · MPP · Blend]
  end

  subgraph data [Data]
    SB[(Supabase Postgres)]
  end

  CD --> STDIO
  CC --> STDIO
  STDIO -->|"NEBULA_TOKEN"| API
  RM --> MCP
  MCP --> PIPE
  API --> PIPE
  UI --> API
  PIPE --> PRIVY
  PIPE --> POL
  PRIVY --> NET
  PIPE --> SB
  UI --> SB
```




| Layer                                    | Role                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| **Hub** (`apps/nebula-hub`)              | Next.js app: Privy auth + custody, dashboard, tool APIs, remote Streamable HTTP MCP |
| **`nebulamcp-core`**                     | Shared Zod tool schemas + confirmation / policy matrix                              |
| **`nebulamcp`**                          | Thin stdio MCP client → Hub (`npx nebulamcp` when published)                        |
| **Landing** (`apps/landing`)             | Marketing site; built into Hub `public/landing` for deploy                          |
| **Policy contract** (`contracts/policy`) | On-chain spend caps / treasury bands when `POLICY_CONTRACT_ID` is set               |


Details and status tables: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---



## Monorepo

```
nebula/
├── apps/
│   ├── nebula-hub/          # Custody Hub (dashboard + APIs + /mcp)
│   └── landing/             # Marketing site → hub public/landing
├── packages/
│   ├── nebulamcp-core/      # nebulamcp-core
│   └── nebulamcp/           # nebulamcp  (bin: nebulamcp)
├── contracts/policy/        # Soroban policy
└── docs/
```

See [docs/STRUCTURE.md](docs/STRUCTURE.md).

---



## Quick start

```bash
pnpm install

# Hub locally (needs apps/nebula-hub/.env.local — copy from .env.example)
pnpm --filter nebulamcp-core build
pnpm --filter nebula-hub dev          # http://localhost:3000

# Optional: marketing site alone
pnpm --filter nebulamcp-core build && pnpm --filter nebula-landing build
pnpm --filter nebula-landing preview
```

**Database:** Supabase Postgres — [docs/SUPABASE.md](docs/SUPABASE.md). Apply `apps/nebula-hub/supabase/hub.sql`.

**Env template:** `[apps/nebula-hub/.env.example](apps/nebula-hub/.env.example)`

Minimum for a working Hub: `DATABASE_URL`, `DIRECT_URL`, Privy (`NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_PRIVATE_KEY`), `NEXT_PUBLIC_APP_URL` / `APP_BASE_URL`.

---



## Connect an agent (MCP)

1. Sign in at [nebulaonchain.xyz](https://nebulaonchain.xyz) → **Connect** → create an agent → copy `nbl_live_…`.
2. Add to Claude Desktop / Cursor:

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

`args` is required — that's how the client launches `nebulamcp`. Prefer `www` for `NEBULA_HUB` so Bearer tokens survive redirects.

**Never put a Stellar secret key in MCP config** — only `NEBULA_TOKEN`.

More: [packages/nebulamcp/README.md](packages/nebulamcp/README.md) · [docs/MCP-DEV.md](docs/MCP-DEV.md).

Remote MCP (Streamable HTTP + OAuth) is also served at Hub `POST /mcp`.

---



## What agents can do


| Capability    | Tools / surface                                                  |
| ------------- | ---------------------------------------------------------------- |
| Wallet        | Balances, identity, fund (testnet), transfer                     |
| Swap          | XLM ↔ Circle USDC on Stellar DEX (`get_swap_quote`, `swap`)      |
| Policy        | Caps, allow/deny lists; on-chain when policy contract configured |
| Confirmations | Human approve flow + `await_confirmation`                        |
| x402          | Pay-walled HTTP via Stellar USDC                                 |
| MPP           | Open session → fetch → close / settle                            |
| Treasury      | Blend XLM deposit/withdraw, auto-yield on activity               |
| Reputation    | Stellar8004-backed agent reputation (Hub-provisioned)            |


---



## Product idea (short)

Agents can already plan and call tools — they still stop at paywalls. Nebula gives each agent a **bounded Stellar wallet**: USDC payments inline (x402), session budgets (MPP), DeFi hooks (Blend), and spend limits the agent cannot bypass. Keys stay in Privy custody on the Hub; the agent only expresses intent.

---



## Docs


| Doc                                     | Contents                               |
| --------------------------------------- | -------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Phase status, stack map                |
| [STRUCTURE.md](docs/STRUCTURE.md)       | Repo layout                            |
| [SUPABASE.md](docs/SUPABASE.md)         | Database setup                         |
| [MCP-DEV.md](docs/MCP-DEV.md)           | MCP testing (x402, MPP, confirmations) |


---



## License

MIT
