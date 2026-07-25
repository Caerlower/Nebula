"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Deep links like /settings/billing → /settings#billing */
export default function SettingsSectionRedirect() {
  const params = useParams<{ section: string }>();
  const router = useRouter();

  useEffect(() => {
    const section = params.section || "account";
    router.replace(`/settings#${section}`);
  }, [params.section, router]);

  return null;
}
