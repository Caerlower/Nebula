"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Moon, PiggyBank, ShieldCheck, Sun } from "lucide-react";

import { ALL_NAV_ITEMS } from "@/components/shell/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/ui";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);
  const setDepositOpen = useUIStore((s) => s.setDepositOpen);
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

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages or run a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem
            onSelect={() =>
              go(() => {
                setCreateAgentOpen(true);
                router.push("/agents");
              })
            }
          >
            <Bot className="size-4" /> Create agent
          </CommandItem>
          <CommandItem
            onSelect={() =>
              go(() => {
                setDepositOpen(true);
                router.push("/treasury");
              })
            }
          >
            <PiggyBank className="size-4" /> Fund wallet
          </CommandItem>
          <CommandItem onSelect={() => go(() => router.push("/policy"))}>
            <ShieldCheck className="size-4" /> Change policy
          </CommandItem>
          <CommandItem onSelect={() => go(toggleTheme)}>
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {ALL_NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(() => router.push(item.href))}>
              <item.icon className="size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
