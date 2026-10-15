import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupNeeded } from "@/components/setup-needed";
import { Card, Skeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">H</div>
        <span className="text-xl font-semibold tracking-tight text-slate-900">HolmOS</span>
      </div>
      <Suspense
        fallback={
          <Card className="w-full max-w-sm p-6">
            <Skeleton className="h-64" />
          </Card>
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  if (!isSupabaseConfigured()) return <SetupNeeded />;

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const noAccess = params.error === "no-access";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims && !noAccess) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");

  return <LoginForm next={next} noAccess={noAccess} signedIn={Boolean(data?.claims)} />;
}
