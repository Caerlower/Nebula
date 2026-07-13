"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, Globe, Menu, Moon, Search, Sun, Sunset } from "lucide-react";
import { toast } from "sonner";

import { breadcrumbsFor } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ListSkeleton } from "@/components/shared/skeletons";
import * as api from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

function Breadcrumbs() {
  const pathname = usePathname();
  const { section, page, detail } = breadcrumbsFor(pathname);
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm sm:flex">
      <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
        Home
      </Link>
      {section ? (
        <>
          <span aria-hidden className="text-subtle">
            /
          </span>
          <span className="text-muted-foreground">{section}</span>
        </>
      ) : null}
      <span aria-hidden className="text-subtle">
        /
      </span>
      <span aria-current="page">{page}</span>
      {detail ? (
        <>
          <span aria-hidden className="text-subtle">
            /
          </span>
          <span className="text-muted-foreground">{detail}</span>
        </>
      ) : null}
    </nav>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data, loading, setData } = useLoad(() => api.getNotifications(), []);
  const hasUnread = (data ?? []).some((n) => !n.read);

  const markAllRead = async () => {
    setData((data ?? []).map((n) => ({ ...n, read: true })));
    try {
      await api.markNotificationsRead();
    } catch {
      toast.error("Couldn't mark notifications as read");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label={hasUnread ? "Notifications — unread available" : "Notifications"}
        >
          <Bell className="size-4" />
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {hasUnread ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {loading ? (
            <ListSkeleton rows={3} className="p-2" />
          ) : (data ?? []).length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing yet — quiet skies.
            </p>
          ) : (
            (data ?? []).map((n) => (
              <div key={n.id} className="flex gap-2.5 rounded-lg px-2.5 py-2 hover:bg-elevated/60">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    n.read ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-subtle">{timeAgo(n.time)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NetworkBadge() {
  const network = useUIStore((s) => s.network);
  const setNetwork = useUIStore((s) => s.setNetwork);
  const [open, setOpen] = useState(false);

  const choose = async (next: "testnet" | "mainnet") => {
    setOpen(false);
    if (next === network) return;
    const previous = network;
    setNetwork(next);
    try {
      await api.setNetwork(next);
      toast.success(`Switched to ${next === "testnet" ? "Testnet" : "Mainnet"}`);
    } catch {
      setNetwork(previous);
      toast.error("Network switch failed", {
        action: { label: "Retry", onClick: () => void choose(next) },
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Network: ${network}. Change network`}>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer gap-1.5 py-1 font-normal",
              network === "testnet" ? "text-warning" : "text-success",
            )}
          >
            <Globe className="size-3" aria-hidden />
            {network === "testnet" ? "Testnet" : "Mainnet"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        {(["testnet", "mainnet"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-elevated"
            onClick={() => void choose(option)}
          >
            <span className="capitalize">{option}</span>
            {network === option ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
          </button>
        ))}
        <p className="px-2.5 pb-1.5 pt-2 text-[11px] leading-relaxed text-subtle">
          Mainnet is simulated in this preview build.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground min-[900px]:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </Button>
      <Breadcrumbs />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Search or run a command"
          className="pressable flex h-8 w-full max-w-md items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 text-sm text-muted-foreground shadow-[var(--card-shadow)] backdrop-blur hover:border-border-strong hover:text-foreground"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 truncate text-left">Search or run command…</span>
          <kbd className="rounded border border-border bg-elevated px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={toggleTheme}
          aria-label={
            theme === "light"
              ? "Theme: warm midnight — switch to violet night"
              : theme === "dark"
                ? "Theme: violet night — switch to daybreak"
                : "Theme: daybreak — switch to warm midnight"
          }
          title={
            theme === "light" ? "Warm midnight" : theme === "dark" ? "Violet night" : "Daybreak"
          }
        >
          {theme === "light" ? (
            <Sunset className="size-4" />
          ) : theme === "dark" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </Button>
        <NotificationsBell />
        <NetworkBadge />
      </div>
    </header>
  );
}
