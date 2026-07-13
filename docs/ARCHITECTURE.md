# Architecture (Phase 1+)

```
packages/nebula-core      Transport-agnostic Zod tools + confirmation matrix
packages/nebula-mcp-stdio Thin stdio MCP → Hub /api/tools/* with NEBULA_TOKEN (@nebula/mcp)
apps/nebula-hub           Next.js Hub: Privy login+custody, Prisma→Supabase, dashboard, /mcp, APIs
apps/landing              Marketing Vite site → nebula-hub/public/landing
```

**Database:** Supabase Postgres (free). Schema: `apps/nebula-hub/supabase/hub.sql`. Setup: [docs/SUPABASE.md](./SUPABASE.md).

**Rule:** private keys never leave the Hub. Clients present `nbl_live_…` or OAuth only.

## Phase 2

| Piece | Status |
|-------|--------|
| Privy session → Hub user + Stellar wallet provision | Done |
| Tool pipeline `POST /api/tools/:name` | Done (`ping` / `help` / wallet / `transfer` + confirmation; treasury tools below) |
| Human approve → Privy sign+submit (or dev dry-run) | Done |
| Policy whitelist / denylist / caps APIs (Hub/DB) | Done |
| Dashboard live data | Done (reputation from agent/wallet auto-provision) |
| Remote Streamable HTTP MCP + OAuth DCR | Done — `POST /mcp`, DCR `/api/oauth/register`, `/authorize`, `/oauth/token` |
| `PRIVY_AUTHORIZATION_PRIVATE_KEY` real signing | Done (`wallet-auth:` PEM wrap + SHA-256) |
| Hub Blend XLM treasury (testnet) | Done — rates, status, deposit/withdraw, threshold, `optimize_treasury` |
| Auto-yield on wallet activity | Done — when a spend needs Blend, **one** Stellar tx bundles WithdrawCollateral + Payment (fallback to sequential if memo / simulate fails); post-transfer only parks excess ≥1 XLM |

## Later

| Piece | Status |
|-------|--------|
| Publish `@nebula/mcp` (+ `@nebula/core`) + `.mcpb` | Pending |
| Soroban policy spend caps + treasury band (`liquid_low` / `liquid_high` / `auto_yield`) | Done when `POLICY_CONTRACT_ID` set — Policy & Treasury UI sync on-chain; transfers call `check_spend` |
| x402 tools (`x402_fetch` / `x402_pay`) in Hub | Done — Privy signs auth entries; USDC via facilitator settle; policy + `check_spend` category `x402` |
| MPP session tools (`mpp_open` / `fetch` / `status` / `close`) in Hub | Done — Hub-hosted `/api/mpp-demo/[channel]` for demos (no local merchant); `mpp_pay` hidden; close settles |
| Stellar8004 reputation / identity | Hub auto-provisions reputation on agent create; `get_my_reputation` live. On-chain Stellar8004 sync still pending |
| Blend USDC + periodic background loop | Pending (XLM + activity-triggered auto-yield covers demo) |
| Approval UX (inbox / notify / agent poll-resume) | Partial — `await_confirmation` tool polls until human approves; inbox polish later |
| Phase 6 demo rehearsals (Claude Desktop + remote connector) | Pending |

Env template: `apps/nebula-hub/.env.example`.
