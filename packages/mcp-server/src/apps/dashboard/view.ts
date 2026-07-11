import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";

type DashboardSnapshot = {
  network: string;
  address: string;
  funded: boolean;
  balances: Array<{ label: string; amount: string }>;
  spending: {
    mode: string;
    maxPerCall: number | null;
    maxPerDay: number | null;
    dailySpent: number | null;
    dailyRemaining: number | null;
    mppSessionReserved: number;
    policyContractId: string | null;
  };
  treasury: {
    asset: string;
    liquid: number;
    blendDeposited: number;
    supplyApy: number | null;
    supplyApyDisplay: string;
    threshold: number | null;
    lastRebalanceAt: string | null;
  } | null;
  identity: { agentId: number | null; registered: boolean };
  mppSession: {
    channel: string;
    budgetUsdc: number;
    cumulativeUsdc: number;
    remainingUsdc: number;
    openedAt: string;
  } | null;
  warnings: string[];
};

function explorerAccountUrl(network: string, address: string): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/account/${address}`;
}

function explorerContractUrl(network: string, contractId: string): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/contract/${contractId}`;
}

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 7 });
}

function render(snapshot: DashboardSnapshot): void {
  const root = document.getElementById("root");
  if (!root) return;

  const spendingLabel =
    snapshot.spending.mode === "onchain" ? "On-chain policy" : "Off-chain limits";

  root.innerHTML = `
    <header class="header">
      <div class="brand"><span class="dot"></span> Nebula</div>
      <div class="pill">${snapshot.network}</div>
    </header>

    <section class="card hero">
      <p class="label">Wallet</p>
      <p class="mono truncate">${snapshot.address}</p>
      <a class="link tiny" href="${explorerAccountUrl(snapshot.network, snapshot.address)}" target="_blank" rel="noopener">View on StellarExpert ↗</a>
      <p class="status ${snapshot.funded ? "ok" : "warn"}">
        ${snapshot.funded ? "Funded · active" : "Not funded — use request_funding or Friendbot"}
      </p>
    </section>

    <section class="grid two">
      <div class="card">
        <p class="label">Balances</p>
        ${
          snapshot.balances.length
            ? snapshot.balances
                .map(
                  (b) =>
                    `<div class="row"><span>${b.label}</span><strong>${b.amount || "—"}</strong></div>`,
                )
                .join("")
            : `<p class="muted">No balances</p>`
        }
      </div>
      <div class="card">
        <p class="label">${spendingLabel}</p>
        <div class="row"><span>Per call</span><strong>${fmt(snapshot.spending.maxPerCall)}</strong></div>
        <div class="row"><span>Daily cap</span><strong>${fmt(snapshot.spending.maxPerDay)}</strong></div>
        <div class="row"><span>Spent</span><strong>${fmt(snapshot.spending.dailySpent)}</strong></div>
        <div class="row"><span>Remaining</span><strong class="accent">${fmt(snapshot.spending.dailyRemaining)}</strong></div>
        ${
          snapshot.spending.mppSessionReserved > 0
            ? `<div class="row"><span>MPP reserved</span><strong>${fmt(snapshot.spending.mppSessionReserved)}</strong></div>`
            : ""
        }
        ${
          snapshot.spending.policyContractId
            ? `<a class="link tiny truncate" href="${explorerContractUrl(snapshot.network, snapshot.spending.policyContractId)}" target="_blank" rel="noopener">Policy contract ↗</a>`
            : ""
        }
      </div>
    </section>

    ${
      snapshot.treasury
        ? `<section class="card">
        <p class="label">Treasury · ${snapshot.treasury.asset}</p>
        <div class="grid three">
          <div class="stat"><span>Liquid</span><strong>${fmt(snapshot.treasury.liquid)}</strong></div>
          <div class="stat"><span>In Blend</span><strong>${fmt(snapshot.treasury.blendDeposited)}</strong></div>
          <div class="stat"><span>Supply APY</span><strong>${snapshot.treasury.supplyApyDisplay}</strong></div>
        </div>
      </section>`
        : ""
    }

    ${
      snapshot.mppSession
        ? `<section class="card">
        <p class="label">MPP session</p>
        <div class="row"><span>Budget</span><strong>${fmt(snapshot.mppSession.budgetUsdc)} USDC</strong></div>
        <div class="row"><span>Committed</span><strong>${fmt(snapshot.mppSession.cumulativeUsdc)} USDC</strong></div>
        <div class="row"><span>Remaining</span><strong>${fmt(snapshot.mppSession.remainingUsdc)} USDC</strong></div>
      </section>`
        : ""
    }

    <section class="card">
      <p class="label">8004 identity</p>
      <p class="value">${snapshot.identity.registered ? `Agent #${snapshot.identity.agentId}` : "Not registered"}</p>
    </section>

    ${
      snapshot.warnings.length
        ? `<section class="card warn-card"><p class="label">Warnings</p><ul>${snapshot.warnings.map((w) => `<li>${w}</li>`).join("")}</ul></section>`
        : ""
    }
  `;
}

function parseSnapshotFromToolResult(params: {
  content?: Array<{ type: string; text?: string }>;
}): DashboardSnapshot | null {
  const text = params.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as DashboardSnapshot;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const app = new App({ name: "Nebula Dashboard", version: "1.0.0" });

  app.ontoolresult = (params) => {
    const snapshot = parseSnapshotFromToolResult(params);
    if (snapshot) {
      render(snapshot);
    }
  };

  app.ontoolinput = () => {
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `<p class="muted center">Loading wallet dashboard…</p>`;
    }
  };

  const transport = new PostMessageTransport(window.parent, window.parent);
  await app.connect(transport);
}

main().catch((error) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<p class="warn center">${error instanceof Error ? error.message : String(error)}</p>`;
  }
});
