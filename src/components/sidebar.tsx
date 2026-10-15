"use client";

import { ChartColumn, LogOut, Menu, Plug, SquareKanban, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { cx } from "@/components/ui";
import { signOutAction } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Pipeline", icon: SquareKanban, match: (p: string) => p === "/" },
  { href: "/clients", label: "Clients", icon: Users, match: (p: string) => p.startsWith("/clients") && !p.endsWith("/dashboard") },
  { href: "/dashboards", label: "Dashboards", icon: ChartColumn, match: (p: string) => p.startsWith("/dashboards") || p.endsWith("/dashboard") },
  { href: "/ad-accounts", label: "Ad accounts", icon: Plug, match: (p: string) => p.startsWith("/ad-accounts") },
];

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  // usePathname suspends on pages with unknown dynamic params; show plain links meanwhile.
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">H</span>
      <span className="text-base font-semibold tracking-tight text-slate-900">HolmOS</span>
    </Link>
  );
}

function SignOut() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </button>
    </form>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <div className="mt-8 flex-1">
          <Nav />
        </div>
        <SignOut />
      </aside>

      {/* Mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-[57px] z-20 border-b border-slate-200 bg-white px-3 pt-2 pb-3 shadow-lg lg:hidden">
          <Nav onNavigate={() => setOpen(false)} />
          <div className="mt-2 border-t border-slate-100 pt-2">
            <SignOut />
          </div>
        </div>
      )}
    </>
  );
}
