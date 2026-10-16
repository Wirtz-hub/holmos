import {
  Award,
  Briefcase,
  Calendar,
  Camera,
  Car,
  Check,
  Clock,
  Coffee,
  Dumbbell,
  GraduationCap,
  Hammer,
  Heart,
  Home,
  Leaf,
  Mail,
  MapPin,
  Paintbrush,
  Phone,
  Scissors,
  Shield,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Truck,
  Users,
  Utensils,
  Wrench,
  Zap,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";
import type { PublicFormDef } from "@/lib/forms/schema";
import { readableOn, type FunnelDoc, type ServiceIcon } from "@/lib/funnels/schema";
import type { PublicCalendar } from "@/lib/public-data";

// Small pieces shared by every page block, the menu and the footer. No hooks,
// so they render on public pages and in the editor alike.

export type FunnelContext = {
  doc: FunnelDoc;
  stepIndex: number;
  /** "/f/<slug>" on HolmOS's address, "" on a custom domain. */
  basePath: string;
  interactive: boolean;
  forms: Record<string, PublicFormDef | { id: string; name: string; fields: PublicFormDef["fields"]; submit_label: string }>;
  calendars: Record<string, Pick<PublicCalendar, "id" | "name" | "duration_minutes" | "slug"> & Partial<PublicCalendar>>;
  /** The block that "Go to the form" buttons scroll to. */
  signupBlockId: string | null;
};

export function themeStyle(doc: FunnelDoc): CSSProperties {
  return { "--accent": doc.theme.accent, "--on-accent": readableOn(doc.theme.accent) } as CSSProperties;
}

export const dark = (ctx: FunnelContext) => ctx.doc.theme.background === "dark";
export const muted = (ctx: FunnelContext) => (dark(ctx) ? "text-slate-300" : "text-slate-600");

export function AccentButton({ href, children, large }: { href: string; children: ReactNode; large?: boolean }) {
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-full font-semibold shadow-sm transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
        large ? "px-7 py-3.5 text-base" : "px-6 py-3 text-sm",
      )}
      style={{ background: "var(--accent)", color: "var(--on-accent)" }}
    >
      {children}
    </a>
  );
}

/** A block's heading and intro, centred above its content. */
export function SectionIntro({ heading, text, ctx }: { heading: string; text?: string; ctx: FunnelContext }) {
  if (!heading && !text) return null;
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{heading}</h2>}
      {text && <RichText text={text} className={cx("mt-3 text-lg", muted(ctx))} center />}
    </div>
  );
}

/** Plain text with blank-line paragraphs and "- " bullet lists. */
export function RichText({ text, className, center }: { text: string; className?: string; center?: boolean }) {
  const groups = text.trim().split(/\n\s*\n/).filter(Boolean);
  return (
    <div className={cx("space-y-4", className)}>
      {groups.map((group, i) => {
        const lines = group.split("\n");
        if (lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
          return (
            <ul key={i} className={cx("space-y-2.5", center && "mx-auto inline-block text-left")}>
              {lines.map((line, j) => (
                <li key={j} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
                  <span>{line.replace(/^\s*[-•*]\s+/, "")}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** A non-working picture of a form, for the editor. */
export function FormPreview({ fields, submitLabel }: { fields: PublicFormDef["fields"]; submitLabel: string }) {
  return (
    <div className="space-y-4" aria-hidden>
      {fields.map((field) =>
        field.type === "checkbox" ? (
          <div key={field.id} className="flex items-center gap-2.5 text-sm">
            <span className="size-4 rounded border border-slate-300" />
            {field.label}
          </div>
        ) : (
          <div key={field.id}>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              {field.label}
              {field.required && <span className="text-rose-600"> *</span>}
            </p>
            <div className={cx("rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-400", field.type === "textarea" ? "h-20 py-2" : "py-2.5")}>
              {field.placeholder || (field.type === "select" ? field.options[0] : " ")}
            </div>
          </div>
        ),
      )}
      <div className="w-full rounded-full py-3 text-center text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        {submitLabel}
      </div>
    </div>
  );
}

const ICONS: Record<ServiceIcon, typeof Check> = {
  check: Check,
  star: Star,
  heart: Heart,
  shield: Shield,
  clock: Clock,
  phone: Phone,
  mail: Mail,
  "map-pin": MapPin,
  wrench: Wrench,
  hammer: Hammer,
  scissors: Scissors,
  sparkles: Sparkles,
  leaf: Leaf,
  home: Home,
  car: Car,
  dumbbell: Dumbbell,
  utensils: Utensils,
  coffee: Coffee,
  briefcase: Briefcase,
  users: Users,
  calendar: Calendar,
  camera: Camera,
  paintbrush: Paintbrush,
  zap: Zap,
  award: Award,
  smile: Smile,
  stethoscope: Stethoscope,
  "graduation-cap": GraduationCap,
  truck: Truck,
  "shopping-bag": ShoppingBag,
};

export function ServiceIconView({ icon, className }: { icon: ServiceIcon; className?: string }) {
  const Icon = ICONS[icon] ?? Check;
  return <Icon className={className} aria-hidden />;
}

/** A picture from Supabase Storage, Unsplash or anywhere the user links to. */
export function Picture({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- images live on other hosts (Supabase Storage, Unsplash)
  return <img src={src} alt={alt} loading="lazy" className={className} />;
}
