"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen, Users, UserRound } from "lucide-react";

import { Wordmark } from "@/components/shell/wordmark";
import { NAV_SECTIONS } from "@/components/shell/nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useNebulaSignOut } from "@/hooks/use-nebula-sign-out";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 ? <div className="mx-1 my-3 h-px bg-border" /> : null}
            {!collapsed ? (
              <p className="px-2 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-subtle">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "pressable relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                      collapsed && "justify-center px-0",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId={collapsed ? "nav-pill-collapsed" : "nav-pill"}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg border border-border-strong bg-elevated shadow-[inset_2px_0_0_var(--primary)]"
                        aria-hidden
                      />
                    ) : null}
                    <item.icon
                      className={cn("relative size-4 shrink-0", active && "text-primary")}
                      aria-hidden
                    />
                    {!collapsed ? <span className="relative">{item.label}</span> : null}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useNebulaSignOut();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-elevated/60",
            collapsed && "justify-center",
          )}
        >
          <Avatar className="size-8">
            {user.imageUrl ? (
              <AvatarImage src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="bg-elevated text-xs">{initialsOf(user.name)}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings/account")}>
          <UserRound className="size-4" /> Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings/team")}>
          <Users className="size-4" /> Team
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => window.open("https://docs.nebulaonchain.xyz", "_blank")}
        >
          <BookOpen className="size-4" /> Docs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface/70 backdrop-blur-xl transition-[width] duration-200 min-[900px]:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border px-4",
          collapsed ? "justify-center px-0" : "justify-between",
        )}
      >
        <Link href="/dashboard" aria-label="Nebula dashboard">
          <Wordmark compact={collapsed} />
        </Link>
        {!collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        ) : null}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-border p-2">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="mb-1 w-full text-muted-foreground"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        ) : null}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
