# Repository structure

Nebula is a **pnpm monorepo**. Application code lives under `apps/`, shared packages under `packages/`, and Soroban contracts at the repo root.

```
nebula/
├── apps/
│   ├── nebula-hub/       # Custody Hub (Privy + MCP HTTP + dashboard)
│   └── landing/          # Marketing → hub public/landing on build:site
├── packages/
│   ├── nebulamcp-core/   # Tool schemas / registry (`nebulamcp-core`)
│   └── nebulamcp/        # Stdio MCP → Hub (`nebulamcp-stdio`, bin: `nebulamcp`)
├── contracts/
│   └── policy/           # Soroban spending-policy contract
├── docs/                 # ARCHITECTURE, SUPABASE, MCP-DEV, …
├── package.json
└── pnpm-workspace.yaml
```

> Folder name ≠ npm package name in two places by design today:
> `apps/landing` → `nebula-landing`, `packages/nebulamcp` → `nebulamcp-stdio`.
> Prefer `--filter <package-name>` over path guesses.

Production site: Hub roots on Vercel; landing is static under Hub. See root [README.md](../README.md).

## Apps

| Package | Path | Command |
|---------|------|---------|
| `nebula-hub` | `apps/nebula-hub` | `pnpm --filter nebula-hub dev` |
| `nebula-landing` | `apps/landing` | `pnpm dev:landing` |

## Packages

| Package | Path | Command |
|---------|------|---------|
| `nebulamcp-core` | `packages/nebulamcp-core` | `pnpm --filter nebulamcp-core build` |
| `nebulamcp-stdio` | `packages/nebulamcp` | `pnpm --filter nebulamcp-stdio build` · **npx:** `npx nebulamcp-stdio` |

## Contracts

- **Source:** `contracts/policy/` — Rust Soroban project
- **Hub WASM / channel:** `apps/nebula-hub/contracts/`

## Hub layout (`apps/nebula-hub/src`)

```
src/
├── app/              # Next.js App Router (pages + API routes)
│   ├── (app)/        # Product shell: dashboard, treasury, policy, …
│   ├── (auth)/       # login (signup aliases to login)
│   └── api/          # HTTP APIs (agents, policy, tools, wallet, …)
├── components/
│   ├── shell/        # App chrome (nav, switcher, command palette)
│   ├── settings/     # Settings sections
│   ├── agents/       # Agent create / fleet UI
│   ├── agent-scope/  # Selected-agent context
│   ├── design/       # Shared design primitives (SectionRule, …)
│   ├── shared/       # Cross-page UI (receipts, badges, dialogs)
│   └── ui/           # Low-level primitives (shadcn)
├── hooks/            # React hooks
├── lib/              # Shared modules (see below)
├── stores/           # Zustand (auth, agent, ui)
├── types/            # Domain types for the Hub UI/API mappers
└── middleware.ts     # Private-beta cookie gate for product routes
```

### `lib/` conventions

| Path | Role |
|------|------|
| `lib/api/` | **Browser** fetch helpers used by the dashboard |
| `lib/hub-tools/` | **Server** MCP/tool execution pipeline |
| `lib/auth/` | Privy resolve (`index`), OAuth, Hub session, beta gate |
| `lib/wallet/` | Freighter challenge/session + connect UX |
| `lib/mcp/` | MCP URL config + Connect-page snippets |
| `lib/policy/` | Allow/deny helpers + optional on-chain policy |
| `lib/stellar8004/` | Stellar8004 identity / reputation |
| `lib/blend/`, `lib/mpp/`, `lib/x402/`, `lib/signing/`, `lib/trustline/` | Domain execution helpers (server) |
| `lib/db.ts`, `lib/stellar.ts`, `lib/fx.ts`, … | Shared infra kept at the root |

Allow/deny list HTTP routes live under `app/api/policy/whitelist` and `app/api/policy/denylist`.

## Landing layout (`apps/landing/src`)

```
src/
├── ui/       # Marketing React sections
├── scene/    # R3F 3D scene
├── lib/      # theme, story, device helpers
├── App.tsx
└── main.tsx
```

## What not to commit

Secrets (`.env.local`), generated `dist/`, and large binary artifacts unless intentional.
