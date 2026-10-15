"use client";

import { Button, Card } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-6">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        This page couldn&apos;t load. It&apos;s usually a temporary connection problem — try again.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
      <Button type="button" className="mt-5" onClick={reset}>
        Try again
      </Button>
    </Card>
  );
}
