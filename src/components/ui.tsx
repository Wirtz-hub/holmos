import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Platform } from "@/lib/types";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const buttonVariants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-600 shadow-sm",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
};

const buttonSizes = { sm: "h-8 px-3", md: "h-10 px-4" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof buttonSizes = "md") {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof buttonSizes }) {
  return <button className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof buttonSizes }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6">
      {back && <div className="mb-2">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export const inputClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

const platformStyles: Record<Platform, { label: string; className: string }> = {
  meta: { label: "Meta", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  google: { label: "Google", className: "bg-orange-50 text-orange-700 ring-orange-200" },
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  const style = platformStyles[platform];
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", style.className)}>
      {style.label}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const styles = {
    info: "bg-brand-50 text-brand-900 ring-brand-100",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    error: "bg-rose-50 text-rose-900 ring-rose-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  return <div className={cx("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", styles[kind])}>{children}</div>;
}
