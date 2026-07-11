# Nebula MCP

**Give your AI agent a Stellar wallet** — payments, yield, spending policy, and on-chain reputation. One `npx` install, like [Pixa's wallet MCP](https://www.npmjs.com/package/pixa-wallet-mcp).

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
        "MAX_PER_DAY": "10000"
      }
    }
  }
}
```

Copy [`mcp.example.json`](./mcp.example.json) · Full install guide: **[INSTALL.md](./INSTALL.md)** · Tool reference: **[TOOLS.md](./TOOLS.md)**

---

## What your agent gets

| Capability | How |
|------------|-----|
| **Wallet** | Hold XLM + USDC, check balances, send transfers |
| **x402 payments** | Auto-pay HTTP 402 APIs with USDC — no human in the loop |
| **MPP sessions** | High-frequency micropayments in one on-chain deposit + off-chain commits |
| **Treasury yield** | Idle funds auto-earn on Blend; withdraw when liquidity drops |
| **Spending policy** | Per-call + daily caps — off-chain or enforced on Soroban |
| **8004 identity** | On-chain agent registration + reputation |
| **Live dashboard** | Interactive wallet UI inside chat (Claude Desktop / MCP Apps) |

**22 tools** · Default **testnet** · Node **18+**

---

## Tools at a glance

### Wallet
`ping` · `get_address` · `check_balance` · `wallet_dashboard` · `request_funding`

### Send
`transfer_xlm` · `transfer_usdc`

### Limits
`spending_report` · `deploy_policy` · `get_policy_status` · `set_policy_limits`

### Pay for APIs
`x402_fetch` · `mpp_open_session` · `mpp_status` · `mpp_fetch` · `mpp_close_session`

### Treasury
`get_treasury_status` · `set_liquidity_threshold` · `optimize_treasury` · `blend_check_rates`

### Identity
`register_identity` · `get_my_reputation`

See **[TOOLS.md](./TOOLS.md)** for parameters, env vars, and example prompts.

---

## Spending limits

Before any transfer or payment signs, Nebula checks caps:

- **Off-chain** — set `MAX_PER_CALL` and `MAX_PER_DAY` in MCP env
- **On-chain** — set `POLICY_CONTRACT_ID` to a Soroban `nebula-policy` contract (deploy with `deploy_policy`)

Treasury rebalancing is **not** subject to agent spending limits.

---

## Claude Desktop (no terminal)

```bash
pnpm --filter nebula-mcp build:mcpb   # from monorepo
```

Double-click `nebula.mcpb` → enter secret key in the install wizard.

---

## First commands to try

```
Use wallet_dashboard from Nebula
Use request_funding from Nebula
Use check_balance from Nebula
Use spending_report from Nebula
```

---

## License

MIT · [GitHub](https://github.com/manavgoyal/Nebula)
