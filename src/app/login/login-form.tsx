"use client";

import { useActionState } from "react";
import { Button, Card, Field, inputClass, Notice } from "@/components/ui";
import { signInAction, signOutAction } from "@/lib/actions/auth";

export function LoginForm({ next, noAccess, signedIn }: { next: string; noAccess: boolean; signedIn: boolean }) {
  const [state, action, pending] = useActionState(signInAction, null);

  if (noAccess && signedIn) {
    return (
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-slate-900">No access</h1>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;re signed in, but this login doesn&apos;t have access to HolmOS.
        </p>
        <form action={signOutAction} className="mt-5">
          <Button type="submit" variant="secondary" className="w-full">
            Sign out
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back to HolmNordic&apos;s workspace.</p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.email}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        {state?.error && <Notice kind="error">{state.error}</Notice>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
