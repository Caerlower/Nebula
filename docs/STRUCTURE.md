# Repository structure

Nebula is a **pnpm monorepo**. Application code lives under `apps/`, shared packages under `packages/`, and Soroban contracts at the repo root.

```
nebula/
├── apps/
│   ├── nebula-hub/       # Custody Hub (Privy + MCP HTTP + dashboard)
│   └── landing/          # Marketing → hub public/landing on build:site
├── packages/
│   ├── nebula-core/      # Tool schemas / registry (`@nebula/core`)
│   └── nebula-mcp-stdio/ # Stdio MCP → Hub (`@nebula/mcp`, bin: `nebula`)
├── contracts/
│   └── policy/           # Soroban spending-policy contract
├── docs/                 # ARCHITECTURE, SUPABASE, MCP-DEV, …
├── package.json
└── pnpm-workspace.yaml
```

Production site: Hub roots on Vercel; landing is static under Hub. See root [README.md](../README.md).

## Apps

| Package | Path | Command |
|---------|------|---------|
| `nebula-hub` | `apps/nebula-hub` | `pnpm --filter nebula-hub dev` |
| `nebula-landing` | `apps/landing` | `pnpm dev:landing` |

## Packages

| Package | Path | Command |
|---------|------|---------|
| `@nebula/core` | `packages/nebula-core` | `pnpm --filter @nebula/core build` |
| `@nebula/mcp` | `packages/nebula-mcp-stdio` | `pnpm --filter @nebula/mcp build` · **npx:** `npx @nebula/mcp` |

## Contracts

- **Source:** `contracts/policy/` — Rust Soroban project
- **Hub WASM / channel:** `apps/nebula-hub/contracts/`

## What not to commit

Secrets (`.env.local`), generated `dist/`, and large binary artifacts unless intentional.
