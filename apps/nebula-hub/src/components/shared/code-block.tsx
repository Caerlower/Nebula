"use client";

import { CopyButton } from "@/components/shared/copy-button";

interface CodeBlockProps {
  code: string;
  language: "bash" | "json" | "typescript" | "python";
  title?: string;
}

/**
 * Lightweight snippet chrome — no Prism/highlighter (those hang Turbopack
 * on this route). Mono + copy is enough for install/config snippets.
 */
export function CodeBlock({ code, language, title }: CodeBlockProps) {
  return (
    <div className="card-edge overflow-hidden rounded-lg border bg-elevated/60">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {title ?? language}
        </span>
        <CopyButton value={code} label={`Copy ${title ?? language} snippet`} />
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[13px] leading-[1.65] text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
