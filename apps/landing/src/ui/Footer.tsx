import { DOCS_URL, HUB_LOGIN, X_URL } from '../lib/links'

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg px-8 pb-[46px] pt-[70px]">
      <div className="mx-auto grid max-w-[1360px] gap-14 md:grid-cols-[minmax(260px,1.5fr)_repeat(2,minmax(140px,0.6fr))]">
        <div>
          <div className="font-display mb-4 text-[19px] font-semibold tracking-[-0.03em]">Nebula</div>
          <p className="m-0 max-w-[320px] text-[13px] leading-[1.68] text-subtle text-pretty">
            Treasury for AI agents on Stellar. Wallets, on-chain policy, idle yield, and machine
            payments behind one MCP.
          </p>
        </div>

        <div className="flex flex-col gap-[11px] font-mono text-[10.5px] uppercase tracking-[0.12em]">
          <div className="mb-1.5 text-subtle">Product</div>
          <a href="#capabilities" className="text-muted transition hover:text-text">
            Capabilities
          </a>
          <a href="#process" className="text-muted transition hover:text-text">
            Process
          </a>
          <a href="#stack" className="text-muted transition hover:text-text">
            Stack
          </a>
          <a href={HUB_LOGIN} className="text-muted transition hover:text-text">
            Sign in
          </a>
        </div>

        <div className="flex flex-col gap-[11px] font-mono text-[10.5px] uppercase tracking-[0.12em]">
          <div className="mb-1.5 text-subtle">Resources</div>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted transition hover:text-text"
          >
            Docs
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          <a href="#security" className="text-muted transition hover:text-text">
            Security
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted transition hover:text-text"
          >
            X / Twitter
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>

      <div className="mx-auto mt-[52px] flex max-w-[1360px] flex-wrap items-center justify-between gap-6 border-t border-border pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        <div className="flex items-center gap-[9px] whitespace-nowrap">
          <span className="live-dot" aria-hidden="true" />
          Live on Stellar mainnet
        </div>
        <div className="whitespace-nowrap">© 2026 Nebula</div>
      </div>
    </footer>
  )
}
