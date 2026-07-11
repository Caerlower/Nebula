# Repository structure

Nebula is a **pnpm monorepo**. Application code lives under `apps/`, shared packages under `packages/`, and Soroban contracts at the repo root.

```
nebula/
├── apps/
│   ├── landing/          # 3D scroll-story marketing site (Vite + R3F)
│   └── web/              # TanStack Start marketing site (paused)
├── packages/
│   └── mcp-server/       # Nebula MCP server (`nebula-mcp`)
├── contracts/
│   └── policy/           # Soroban spending-policy contract (source)
├── scripts/              # Repo-level tooling (Vercel config, etc.)
├── docs/                 # Internal docs
├── package.json          # Workspace root scripts
└── pnpm-workspace.yaml
```

## Apps

| Package | Path | Command |
|---------|------|---------|
| `nebula-landing` | `apps/landing` | `pnpm dev:landing` |
| `nebula-frontend` | `apps/web` | `pnpm dev:web` |

## Packages

| Package | Path | Command |
|---------|------|---------|
| `nebula-mcp` | `packages/mcp-server` | `pnpm dev:mcp` · **npm:** `npx nebula-mcp` |

MCP server dev/test harnesses live in `packages/mcp-server/scripts/dev/`. Build scripts are in `packages/mcp-server/scripts/build/`.

## Contracts

- **Source:** `contracts/policy/` — Rust Soroban project, tests, deploy scripts
- **Bundled WASM:** `packages/mcp-server/contracts/*.wasm` — copied into the MCP server dist on build

## What not to commit

- `Pixa/` — local reference clone (gitignored)
- `node_modules/`, `dist/`, `.env`, `.vercel/`
- Agent tooling: `.agents/`, `.claude/`, `skills-lock.json`
