"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useUIStore } from "@/stores/ui";

/** Legacy route — open the Fleet create drawer instead of a full-page form. */
export default function NewAgentRedirectPage() {
  const router = useRouter();
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);

  useEffect(() => {
    setCreateAgentOpen(true);
    router.replace("/agents");
  }, [router, setCreateAgentOpen]);

  return null;
}
