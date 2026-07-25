"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { ALL_NAV_ITEMS } from "@/components/shell/nav";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";

type Row = {
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setDepositOpen = useUIStore((s) => s.setDepositOpen);
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);
  const { selectedAgent, reloadAgents } = useAgentScope();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!useUIStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const close = () => setOpen(false);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const agentName = selectedAgent?.name;

    if (selectedAgent) {
      const paused = selectedAgent.status === "paused";
      list.push({
        group: "AGENT",
        label: paused
          ? `Resume ${agentName}`
          : `Pause ${agentName}`,
        keywords: `pause resume agent ${agentName}`,
        run: async () => {
          try {
            await api.setPolicyPaused(!paused);
            toast.success(paused ? "Agent resumed" : "Agent paused");
            reloadAgents();
          } catch {
            toast.error(paused ? "Couldn't resume agent" : "Couldn't pause agent");
          }
        },
      });
      list.push({
        group: "GO TO",
        label: `Spending policy · ${agentName}`,
        keywords: `policy spending ${agentName}`,
        run: () => router.push("/policy"),
      });
      list.push({
        group: "TREASURY",
        label: "Fund wallet",
        keywords: "fund deposit treasury wallet",
        run: () => {
          setDepositOpen(true);
          router.push("/treasury");
        },
      });
      list.push({
        group: "LOG",
        label: "Activity",
        keywords: "activity transactions log history",
        run: () => router.push("/transactions"),
      });
    }

    list.push({
      group: "AGENT",
      label: "Create agent",
      keywords: "new create agent",
      run: () => {
        router.push("/agents");
        setCreateAgentOpen(true);
      },
    });

    list.push({
      group: "GO TO",
      label: "Fleet",
      keywords: "fleet agents list",
      run: () => router.push("/agents"),
    });

    for (const item of ALL_NAV_ITEMS) {
      if (item.href === "/agents") continue;
      if (
        selectedAgent &&
        (item.href === "/policy" ||
          item.href === "/treasury" ||
          item.href === "/transactions")
      ) {
        continue;
      }
      if (list.some((r) => r.label === item.label && r.group === "GO TO")) {
        continue;
      }
      list.push({
        group: "GO TO",
        label: item.label,
        keywords: `${item.label} ${item.href}`,
        run: () => router.push(item.href),
      });
    }

    list.push({
      group: "GO TO",
      label: "Account settings",
      keywords: "settings account billing team",
      run: () => router.push("/settings"),
    });

    list.push({
      group: "SYSTEM",
      label: "Toggle theme",
      keywords: "theme dark light day",
      run: () => toggleTheme(),
    });

    return list;
  }, [
    selectedAgent,
    reloadAgents,
    router,
    setCreateAgentOpen,
    setDepositOpen,
    toggleTheme,
  ]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[rgba(6,6,8,0.72)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="Command palette"
          className="fixed top-[14vh] left-1/2 z-[80] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-[var(--line-2,var(--border))] bg-[var(--panel,var(--surface))] shadow-[0_44px_100px_-30px_rgba(0,0,0,0.75)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Jump to a page or run a command
          </DialogPrimitive.Description>
          <CommandPrimitive
            className="flex flex-col"
            filter={(value, search) => {
              if (!search) return 1;
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-3 border-b border-border px-[18px] py-4">
              <span className="font-mono text-[12px] text-primary" aria-hidden>
                ›
              </span>
              <CommandPrimitive.Input
                placeholder="Jump to a page or run a command…"
                className="min-w-0 flex-1 bg-transparent font-mono text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-subtle">
                ESC
              </span>
            </div>

            <CommandPrimitive.List className="max-h-[min(420px,55vh)] overflow-y-auto">
              <CommandPrimitive.Empty className="px-[18px] py-8 font-mono text-[12px] text-muted-foreground">
                No matching commands.
              </CommandPrimitive.Empty>

              {rows.map((row) => (
                <CommandPrimitive.Item
                  key={`${row.group}-${row.label}`}
                  value={`${row.group} ${row.label} ${row.keywords ?? ""}`}
                  onSelect={() => {
                    close();
                    void row.run();
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3.5 border-b border-border px-[18px] py-[13px] outline-none",
                    "data-[selected=true]:bg-[var(--accent-soft)]",
                  )}
                >
                  <span className="w-16 shrink-0 font-mono text-[9px] tracking-[0.12em] text-subtle">
                    {row.group}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {row.label}
                  </span>
                  {row.hint ? (
                    <span className="shrink-0 font-mono text-[10px] text-subtle">
                      {row.hint}
                    </span>
                  ) : null}
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
