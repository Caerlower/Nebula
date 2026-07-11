export function Footer() {
  return (
    <footer className="border-t border-border px-6 pt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-sm font-semibold tracking-[0.42em] text-text">NEBULA</span>
          <p className="mt-2 max-w-xs text-sm text-muted">
            MCP wallet infrastructure for AI agents on Stellar.
          </p>
        </div>
        <nav className="flex items-center gap-8 text-sm text-muted">
          <a className="transition hover:text-text" href="#">
            Docs
          </a>
          <a className="transition hover:text-text" href="#">
            X
          </a>
          <a className="transition hover:text-text" href="#">
            GitHub
          </a>
        </nav>
      </div>
      <div className="mx-auto mt-10 max-w-6xl border-t border-border py-5">
        <p className="text-xs text-subtle">© 2026 Nebula · Built on Stellar</p>
      </div>
    </footer>
  )
}
