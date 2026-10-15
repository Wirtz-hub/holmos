"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, cx } from "@/components/ui";

// Copy-and-paste snippets for putting a form or booking page on another website.

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-inset",
        copied ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
      )}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

export type Snippet = { title: string; description: string; code: string };

export function EmbedCode({ intro, snippets }: { intro: string; snippets: Snippet[] }) {
  return (
    <Card className="max-w-3xl">
      <CardHeader title="Put it on a website" description={intro} />
      <div className="divide-y divide-slate-100">
        {snippets.map((snippet) => (
          <div key={snippet.title} className="space-y-2 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{snippet.title}</h3>
                <p className="text-sm text-slate-500">{snippet.description}</p>
              </div>
              <CopyButton text={snippet.code} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
              <code>{snippet.code}</code>
            </pre>
          </div>
        ))}
      </div>
    </Card>
  );
}
