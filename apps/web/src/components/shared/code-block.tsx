"use client";

import { PrismLight } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";

import { CopyButton } from "@/components/shared/copy-button";

PrismLight.registerLanguage("bash", bash);
PrismLight.registerLanguage("json", json);
PrismLight.registerLanguage("typescript", typescript);
PrismLight.registerLanguage("python", python);

/**
 * Prism theme mapped onto Nebula tokens: comments in muted ink, strings in
 * teal, keywords in the warm accent — consumed as CSS variables so both
 * themes restyle automatically.
 */
const nebulaSyntaxTheme: Record<string, React.CSSProperties> = {
  'pre[class*="language-"]': {
    background: "transparent",
    color: "var(--foreground)",
    margin: 0,
    padding: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    lineHeight: "1.65",
  },
  'code[class*="language-"]': {
    background: "transparent",
    color: "var(--foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    lineHeight: "1.65",
  },
  comment: { color: "var(--muted-foreground)", fontStyle: "italic" },
  prolog: { color: "var(--muted-foreground)" },
  punctuation: { color: "var(--muted-foreground)" },
  property: { color: "var(--foreground)" },
  string: { color: "var(--accent-teal)" },
  "attr-value": { color: "var(--accent-teal)" },
  char: { color: "var(--accent-teal)" },
  url: { color: "var(--accent-teal)" },
  keyword: { color: "var(--accent-warm)" },
  boolean: { color: "var(--accent-warm)" },
  number: { color: "var(--accent-warm)" },
  function: { color: "var(--primary)" },
  "class-name": { color: "var(--primary)" },
  builtin: { color: "var(--primary)" },
  operator: { color: "var(--muted-foreground)" },
  variable: { color: "var(--foreground)" },
};

interface CodeBlockProps {
  code: string;
  language: "bash" | "json" | "typescript" | "python";
  title?: string;
}

export function CodeBlock({ code, language, title }: CodeBlockProps) {
  return (
    <div className="card-edge overflow-hidden rounded-lg border bg-elevated/60">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {title ?? language}
        </span>
        <CopyButton value={code} label={`Copy ${title ?? language} snippet`} />
      </div>
      <div className="overflow-x-auto p-3.5">
        <PrismLight language={language} style={nebulaSyntaxTheme} wrapLongLines={false}>
          {code}
        </PrismLight>
      </div>
    </div>
  );
}
