import { Card } from "@/components/ui";

export function SetupNeeded() {
  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="text-lg font-semibold text-slate-900">HolmOS isn&apos;t connected to its database yet</h1>
      <p className="mt-2 text-sm text-slate-600">
        Add your Supabase details to the app&apos;s settings, then reload this page. The setup guide (SETUP.md) walks
        through it step by step.
      </p>
      <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-700">
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
        <li>SUPABASE_SECRET_KEY</li>
        <li>TOKEN_ENCRYPTION_KEY</li>
      </ul>
    </Card>
  );
}
