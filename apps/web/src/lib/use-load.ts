"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Standard data-loading hook: skeleton while pending, sonner toast with a
 * retry action on failure. `deps` re-runs the loader (e.g. filters).
 */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const generation = useRef(0);

  const run = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (gen === generation.current) setData(result);
    } catch (err) {
      if (gen !== generation.current) return;
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      toast.error("Couldn't load data", {
        description: e.message,
        action: { label: "Retry", onClick: () => void run() },
      });
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData } as const;
}
