"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type TabsValueContextValue = {
  value: string | undefined;
};

const TabsValueContext = React.createContext<TabsValueContextValue | null>(
  null,
);

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [uncontrolled, setUncontrolled] = React.useState(
    defaultValue !== undefined ? String(defaultValue) : undefined,
  );
  const current = value !== undefined ? String(value) : uncontrolled;

  return (
    <TabsValueContext.Provider value={{ value: current }}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => {
          if (value === undefined) setUncontrolled(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsValueContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

type PillBox = { x: number; width: number; ready: boolean };

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(TabsValueContext);
  const reduceMotion = useReducedMotion();
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [pill, setPill] = React.useState<PillBox>({
    x: 0,
    width: 0,
    ready: false,
  });

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const measure = React.useCallback(() => {
    const list = listRef.current;
    const active = ctx?.value;
    if (!list || !active) return;
    const trigger = list.querySelector<HTMLElement>(
      `[data-tabs-trigger="${CSS.escape(active)}"]`,
    );
    if (!trigger) return;
    // offsetLeft/Width are relative to the list (no Dialog transform skew).
    setPill({
      x: trigger.offsetLeft,
      width: trigger.offsetWidth,
      ready: true,
    });
  }, [ctx?.value]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, children]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(list);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative inline-flex h-9 items-center justify-center rounded-full border border-border bg-muted/60 p-1 text-muted-foreground",
        className,
      )}
      {...props}
    >
      {pill.ready ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full border border-border-strong bg-elevated shadow-[var(--card-shadow)]"
          initial={false}
          animate={{ x: pill.x, width: pill.width }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 34 }
          }
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const ctx = React.useContext(TabsValueContext);
  const active = ctx?.value !== undefined && String(value) === ctx.value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      data-tabs-trigger={value}
      className={cn(
        "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed hover:text-foreground data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      <span className={cn("relative z-10", active && "text-foreground")}>
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
