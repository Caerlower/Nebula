"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CreditCard,
  LogOut,
  Menu,
  Users,
  UserRound,
} from "lucide-react";

import {
  AgentScopeGate,
  AgentScopeProvider,
  useAgentScope,
} from "@/components/agent-scope/agent-scope";
import { CreateAgentDrawer } from "@/components/agents/create-agent-drawer";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AgentSwitcher } from "@/components/shell/agent-switcher";
import { CommandPalette } from "@/components/shell/command-palette";
import {
  ACCOUNT_UTILITIES,
  ALL_NAV_ITEMS,
  isAgentWorkspaceRoute,
  tabsFor,
} from "@/components/shell/nav";
import { Wordmark } from "@/components/shell/wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNebulaSignOut } from "@/hooks/use-nebula-sign-out";
import { warmHubCaches } from "@/lib/api";
import { cn, truncMiddle } from "@/lib/utils";
import {
  hubOriginFor,
  mainnetPreferenceAllowed,
} from "@/lib/network";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { toast } from "sonner";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function HeaderAvatar() {
  const user = useAuthStore((s) => s.user);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const walletAddress = useAuthStore((s) => s.walletAddress);
  const signOut = useNebulaSignOut();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const isWallet = walletAuthed && Boolean(walletAddress);
  const primary = isWallet
    ? truncMiddle(walletAddress ?? user.name, 5, 5)
    : user.name;
  const secondary = isWallet ? "STELLAR WALLET" : user.email?.toUpperCase() ?? "";
  const initials = initialsOf(user.name);

  const goSettings = (hash: string) => {
    setOpen(false);
    router.push(`/settings#${hash}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-[var(--panel-3)] font-mono text-[11px]"
        >
          {user.imageUrl ? (
            <Avatar className="size-full">
              <AvatarImage src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-[var(--panel-3)] text-[11px]">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            initials
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[280px] overflow-hidden rounded-2xl border-border-strong p-0 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
          <Avatar className="size-8 shrink-0">
            {user.imageUrl ? (
              <AvatarImage src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="bg-[var(--panel-3)] font-mono text-[11px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] tracking-[-0.01em]">
              {primary}
            </p>
            <p className="truncate font-mono text-[9px] tracking-[0.12em] text-subtle">
              {secondary}
            </p>
          </div>
        </div>
        <div className="py-1">
          <button
            type="button"
            onClick={() => goSettings("account")}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left font-mono text-[11px] tracking-[0.06em] text-foreground hover:bg-elevated/50"
          >
            <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
            ACCOUNT SETTINGS
          </button>
          <button
            type="button"
            onClick={() => goSettings("billing")}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left font-mono text-[11px] tracking-[0.06em] text-foreground hover:bg-elevated/50"
          >
            <CreditCard className="size-3.5 text-muted-foreground" aria-hidden />
            BILLING
          </button>
          <button
            type="button"
            onClick={() => goSettings("team")}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left font-mono text-[11px] tracking-[0.06em] text-foreground hover:bg-elevated/50"
          >
            <Users className="size-3.5 text-muted-foreground" aria-hidden />
            TEAM
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
          className="flex w-full items-center gap-3 border-t border-border px-3.5 py-2.5 text-left font-mono text-[11px] tracking-[0.06em] text-destructive hover:bg-elevated/50"
        >
          <LogOut className="size-3.5" aria-hidden />
          SIGN OUT
        </button>
      </PopoverContent>
    </Popover>
  );
}

function NetworkChip() {
  const network = useUIStore((s) => s.network);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"testnet" | "mainnet" | null>(null);
  const [busy, setBusy] = useState(false);
  const mainnetAllowed = mainnetPreferenceAllowed();

  const label = network === "mainnet" ? "MAINNET" : "TESTNET";

  const choose = (option: "testnet" | "mainnet") => {
    if (option === network || busy) return;
    if (option === "mainnet" && !mainnetAllowed) {
      toast.error("Mainnet is temporarily disabled");
      return;
    }
    setOpen(false);
    setPending(option);
  };

  const confirmSwitch = () => {
    if (!pending) return;
    setBusy(true);
    const dest = `${hubOriginFor(pending)}${window.location.pathname}${window.location.search}`;
    window.location.assign(dest);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Stellar network: ${label}. Click to switch`}
            className="ml-0.5 inline-flex shrink-0 items-center rounded-full border border-border px-[11px] py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[280px] gap-0 overflow-hidden rounded-[18px] border border-border bg-surface p-0 shadow-[var(--card-shadow)]"
        >
          <div className="border-b border-border px-5 pt-5 pb-4">
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              STELLAR NETWORK
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Opens the other Hub host (
              {hubOriginFor("testnet").replace("https://", "")} /{" "}
              {hubOriginFor("mainnet").replace("https://", "")}). Sessions are
              separate — you sign in again on the other ledger.
            </p>
          </div>
          <ul className="space-y-1.5 px-3 py-3">
            {(["testnet", "mainnet"] as const).map((option) => {
              const active = network === option;
              const disabled =
                busy || (option === "mainnet" && !mainnetAllowed);
              return (
                <li key={option}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-50",
                      active
                        ? "border-border-strong bg-[var(--panel-3)]"
                        : "border-border hover:border-border-strong hover:bg-[var(--panel-3)]/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        active ? "bg-primary" : "bg-subtle",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium capitalize">
                        {option}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                        {active
                          ? "ACTIVE · THIS HOST"
                          : option === "mainnet"
                            ? mainnetAllowed
                              ? "PUBNET · SIGN IN AGAIN"
                              : "DISABLED"
                            : "SDF TESTNET · SIGN IN AGAIN"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next && !busy) setPending(null);
        }}
        title={
          pending === "mainnet"
            ? "Open mainnet Hub?"
            : "Open testnet Hub?"
        }
        description={
          pending === "mainnet"
            ? `You’ll go to ${hubOriginFor("mainnet")} and need to sign in again. Agents, wallets, and policy on that host are separate from testnet.`
            : `You’ll go to ${hubOriginFor("testnet")} and need to sign in again. Agents, wallets, and policy on that host are separate from mainnet.`
        }
        confirmLabel={pending === "mainnet" ? "Go to mainnet" : "Go to testnet"}
        onConfirm={confirmSwitch}
      />
    </>
  );
}

function ThemePill() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  // Label is the destination: day → DARK, night → LIGHT.
  const label = theme === "day" ? "DARK" : "LIGHT";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex shrink-0 items-center rounded-full border border-border px-[13px] py-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground"
      aria-label={`Switch to ${label.toLowerCase()} theme`}
      title={label}
    >
      {label}
    </button>
  );
}

function HeaderTabs({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const tabs = tabsFor(pathname);
  const activeHref = tabs
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-[41px] items-center gap-[26px] overflow-x-auto"
    >
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-full shrink-0 items-center border-b-2 px-px font-mono text-[11px] tracking-[0.1em] uppercase transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);
  const pathname = usePathname();
  const tabs = tabsFor(pathname);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>
            <Link href="/agents" onClick={() => setOpen(false)} aria-label="Nebula — account home">
              <Wordmark />
            </Link>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {tabs.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 font-mono text-[12px] tracking-[0.08em] uppercase",
                  active
                    ? "bg-elevated text-foreground"
                    : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
          {!isAgentWorkspaceRoute(pathname) ? (
            <>
              <div className="my-3 h-px bg-border" />
              {ACCOUNT_UTILITIES.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function AppHeader() {
  const pathname = usePathname();
  const { selectedAgent } = useAgentScope();
  const onSettings = pathname.startsWith("/settings");
  const inWorkspace =
    isAgentWorkspaceRoute(pathname) || (onSettings && Boolean(selectedAgent));
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <header className="z-40 shrink-0 border-b border-border bg-background/90 backdrop-blur-[14px]">
      <div className="mx-auto flex h-[58px] max-w-[1400px] items-center gap-[22px] px-4 sm:px-7">
        <button
          type="button"
          className="text-muted-foreground lg:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <Link href="/agents" className="flex shrink-0 items-center gap-2" aria-label="Nebula">
          <Wordmark />
          <NetworkChip />
        </Link>

        <div className="hidden h-[26px] w-px shrink-0 bg-border sm:block" aria-hidden />

        {inWorkspace ? (
          <div className="min-w-0">
            <AgentSwitcher />
          </div>
        ) : (
          <span className="hidden font-mono text-[11px] tracking-[0.1em] text-subtle uppercase sm:inline">
            Fleet
          </span>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden items-center gap-2.5 rounded-full border border-border px-4 py-2 text-muted-foreground md:inline-flex"
          aria-label="Open command palette"
        >
          <span className="font-mono text-[11px]">Search agents, tx, addresses</span>
          <span className="rounded-sm border border-border px-1.5 py-0 font-mono text-[10px] text-subtle">
            ⌘K
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground md:hidden"
          aria-label="Open command palette"
        >
          ⌘K
        </button>

        <ThemePill />
        <HeaderAvatar />
      </div>

      <div className="mx-auto hidden h-[42px] max-w-[1400px] items-center gap-[26px] border-t border-border px-4 sm:px-7 lg:flex">
        <HeaderTabs />
        <div className="flex-1" />
        <LedgerPulse />
      </div>
    </header>
  );
}

function LedgerPulse() {
  const [ledger, setLedger] = useState(54_912_338);

  useEffect(() => {
    setLedger(54_800_000 + Math.floor(Date.now() / 5000) % 100_000);
    const id = window.setInterval(() => {
      setLedger((n) => n + 1);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-2.5 font-mono text-[10px] tracking-[0.1em] text-subtle">
      LEDGER {ledger.toLocaleString("en-US")}
      <span
        className="size-1.5 animate-[nebula-pulse_2.4s_ease-in-out_infinite] rounded-full bg-success"
        aria-hidden
      />
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sectionKey = `/${pathname.split("/")[1] ?? ""}`;

  useEffect(() => {
    for (const item of ALL_NAV_ITEMS) {
      void router.prefetch(item.href);
    }
    warmHubCaches();
    const rewarm = window.setInterval(warmHubCaches, 45_000);
    return () => window.clearInterval(rewarm);
  }, [router]);

  return (
    <AgentScopeProvider>
      <div className="flex h-dvh flex-col overflow-hidden overscroll-none">
        <AppHeader />
        <MobileNav />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
          <motion.div
            key={sectionKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="mx-auto w-full max-w-[1400px] px-4 pb-[90px] pt-8 sm:px-7"
          >
            <AgentScopeGate>{children}</AgentScopeGate>
          </motion.div>
        </main>
        <CreateAgentDrawer />
        <CommandPalette />
      </div>
    </AgentScopeProvider>
  );
}
