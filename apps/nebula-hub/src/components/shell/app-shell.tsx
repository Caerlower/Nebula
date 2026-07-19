"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  AgentScopeGate,
  AgentScopeProvider,
} from "@/components/agent-scope/agent-scope";
import { ALL_NAV_ITEMS } from "@/components/shell/nav";
import { Sidebar, SidebarNav, UserMenu } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Wordmark } from "@/components/shell/wordmark";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { warmHubCaches } from "@/lib/api";
import { useUIStore } from "@/stores/ui";

function MobileNav() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);

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
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="border-t border-border p-2">
          <UserMenu />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Animate page entrances only when the top-level section changes —
  // sub-route swaps (e.g. /settings/account → /settings/team) must not
  // replay the whole-page rise-in.
  const sectionKey = `/${pathname.split("/")[1] ?? ""}`;

  // Warm Turbopack / RSC caches for every nav destination so first click isn't a 5–10s compile.
  useEffect(() => {
    for (const item of ALL_NAV_ITEMS) {
      void router.prefetch(item.href);
    }
    // Warm the data caches so first visits paint instantly, and keep them
    // warm so page changes always hit fresh cache.
    warmHubCaches();
    const rewarm = window.setInterval(warmHubCaches, 45_000);
    return () => window.clearInterval(rewarm);
  }, [router]);

  return (
    <AgentScopeProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <motion.div
              key={sectionKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-7xl p-4 sm:p-8"
            >
              <AgentScopeGate>{children}</AgentScopeGate>
            </motion.div>
          </main>
        </div>
      </div>
    </AgentScopeProvider>
  );
}
