import { CalendarDays, Check, Clock, Quote } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { BookingWidget } from "@/components/public/booking-widget";
import { PublicForm } from "@/components/public/public-form";
import { cx } from "@/components/ui";
import type { PublicFormDef } from "@/lib/forms/schema";
import { buttonHref, nextStepHref, readableOn, type Block, type BlockOf, type FunnelDoc } from "@/lib/funnels/schema";
import type { PublicCalendar } from "@/lib/public-data";

// Renders landing page blocks. Shared by the public pages (interactive forms
// and booking) and the editor (static previews), so it has no hooks of its own.

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

export function FunnelFrame({ doc, children, className }: { doc: FunnelDoc; children: ReactNode; className?: string }) {
  const { background, font } = doc.theme;
  return (
    <div
      lang={doc.language}
      style={themeStyle(doc)}
      className={cx(
        background === "dark" ? "bg-slate-950 text-slate-100" : background === "soft" ? "bg-[#f6f5f1] text-slate-900" : "bg-white text-slate-900",
        font === "serif" && "font-serif",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The first form or booking block on the step: where "Go to the form" leads. */
export function signupBlockId(blocks: Block[]) {
  return blocks.find((b) => b.type === "form" || b.type === "booking")?.id ?? null;
}

export function FunnelStepView({ ctx }: { ctx: FunnelContext }) {
  const step = ctx.doc.steps[ctx.stepIndex];
  return (
    <FunnelFrame doc={ctx.doc} className="min-h-dvh">
      <main>
        {step.blocks.map((block) => (
          <BlockView key={block.id} block={block} ctx={ctx} />
        ))}
      </main>
    </FunnelFrame>
  );
}

const dark = (ctx: FunnelContext) => ctx.doc.theme.background === "dark";

function AccentButton({ href, children, large }: { href: string; children: ReactNode; large?: boolean }) {
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

export function BlockView({ block, ctx }: { block: Block; ctx: FunnelContext }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} ctx={ctx} />;
    case "text":
      return <TextBlock block={block} ctx={ctx} />;
    case "image":
      return <ImageBlock block={block} />;
    case "form":
      return <FormBlock block={block} ctx={ctx} />;
    case "cta":
      return <CtaBlock block={block} ctx={ctx} />;
    case "testimonials":
      return <TestimonialsBlock block={block} ctx={ctx} />;
    case "booking":
      return <BookingBlock block={block} ctx={ctx} />;
  }
}

const muted = (ctx: FunnelContext) => (dark(ctx) ? "text-slate-300" : "text-slate-600");

function HeroBlock({ block, ctx }: { block: BlockOf<"hero">; ctx: FunnelContext }) {
  const href = buttonHref(ctx.doc, ctx.stepIndex, block.button, ctx.basePath);
  const split = block.layout === "split" && block.imageUrl;
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" style={{ background: "color-mix(in srgb, var(--accent) 9%, transparent)" }}>
      <div className={cx("mx-auto max-w-6xl", split ? "grid items-center gap-10 md:grid-cols-2" : "text-center")}>
        <div className={cx(!split && "mx-auto max-w-3xl")}>
          {block.eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">{block.eyebrow}</p>}
          {block.heading && <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">{block.heading}</h1>}
          {block.text && <RichText text={block.text} className={cx("mt-5 text-lg leading-relaxed", muted(ctx))} center={!split} />}
          {block.buttonLabel && (
            <div className="mt-8">
              <AccentButton href={href} large>
                {block.buttonLabel}
              </AccentButton>
            </div>
          )}
        </div>
        {block.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- images live on Supabase Storage or anywhere the user links to
          <img
            src={block.imageUrl}
            alt=""
            className={cx("w-full rounded-2xl object-cover shadow-lg", split ? "aspect-[4/3]" : "mx-auto mt-12 max-w-4xl")}
          />
        )}
      </div>
    </section>
  );
}

function TextBlock({ block, ctx }: { block: BlockOf<"text">; ctx: FunnelContext }) {
  const center = block.align === "center";
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <div className={cx("mx-auto max-w-3xl", center && "text-center")}>
        {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{block.heading}</h2>}
        {block.text && <RichText text={block.text} className={cx("mt-4 text-lg leading-relaxed", muted(ctx))} center={center} />}
      </div>
    </section>
  );
}

function ImageBlock({ block }: { block: BlockOf<"image"> }) {
  if (!block.url) {
    return (
      <section className="px-4 py-8">
        <div className="mx-auto grid h-48 max-w-3xl place-items-center rounded-2xl border-2 border-dashed border-current/20 text-sm opacity-60">
          No picture chosen yet
        </div>
      </section>
    );
  }
  const full = block.size === "full";
  return (
    <figure className={cx(full ? "py-8" : "px-4 py-8 sm:px-6")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- images live on Supabase Storage or anywhere the user links to */}
      <img
        src={block.url}
        alt={block.alt}
        className={cx("mx-auto w-full object-cover", full ? "" : "rounded-2xl shadow-md", block.size === "medium" ? "max-w-2xl" : block.size === "wide" ? "max-w-5xl" : "")}
      />
      {block.caption && <figcaption className="mx-auto mt-3 max-w-3xl px-4 text-center text-sm opacity-70">{block.caption}</figcaption>}
    </figure>
  );
}

function FormBlock({ block, ctx }: { block: BlockOf<"form">; ctx: FunnelContext }) {
  const form = block.formId ? ctx.forms[block.formId] : undefined;
  // Visitors never see an empty box when a form is switched off.
  if (!form && ctx.interactive) return null;
  return (
    <section id={ctx.signupBlockId === block.id ? "signup" : undefined} className="scroll-mt-6 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-lg ring-1 ring-slate-900/5 sm:p-8">
        {block.heading && <h2 className="text-2xl font-bold tracking-tight">{block.heading}</h2>}
        {block.text && <RichText text={block.text} className="mt-2 text-slate-600" />}
        <div className={cx((block.heading || block.text) && "mt-6")}>
          {!form ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              {block.formId ? "This form is switched off or was deleted." : "Choose which form to show in the block settings."}
            </p>
          ) : ctx.interactive && "success_message" in form ? (
            <PublicForm
              form={form}
              nextHref={block.afterSubmit === "next" ? nextStepHref(ctx.doc, ctx.stepIndex, ctx.basePath) : null}
            />
          ) : (
            <FormPreview fields={form.fields} submitLabel={form.submit_label} />
          )}
        </div>
      </div>
    </section>
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

function CtaBlock({ block, ctx }: { block: BlockOf<"cta">; ctx: FunnelContext }) {
  const href = buttonHref(ctx.doc, ctx.stepIndex, block.button, ctx.basePath);
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-4xl rounded-3xl px-6 py-10 text-center sm:px-12 sm:py-14" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{block.heading}</h2>}
        {block.text && <RichText text={block.text} className="mx-auto mt-3 max-w-2xl text-lg opacity-90" center />}
        {block.buttonLabel && (
          <a
            href={href}
            className="mt-8 inline-flex items-center justify-center rounded-full px-7 py-3.5 text-base font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--on-accent)", color: "var(--accent)" }}
          >
            {block.buttonLabel}
          </a>
        )}
      </div>
    </section>
  );
}

function TestimonialsBlock({ block, ctx }: { block: BlockOf<"testimonials">; ctx: FunnelContext }) {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        {block.heading && <h2 className="text-center text-2xl font-bold tracking-tight text-balance sm:text-3xl">{block.heading}</h2>}
        <div className={cx("mt-8 grid gap-5", block.items.length === 1 ? "mx-auto max-w-2xl" : block.items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
          {block.items.map((item, i) => (
            <figure
              key={i}
              className={cx("rounded-2xl p-6 ring-1", dark(ctx) ? "bg-white/5 ring-white/10" : "bg-white shadow-sm ring-slate-900/5")}
            >
              <Quote className="size-6 text-[var(--accent)]" aria-hidden />
              <blockquote className="mt-3 text-base leading-relaxed">{item.quote}</blockquote>
              {(item.name || item.role) && (
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold">{item.name}</span>
                  {item.role && <span className={muted(ctx)}>{item.name ? " · " : ""}{item.role}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingBlock({ block, ctx }: { block: BlockOf<"booking">; ctx: FunnelContext }) {
  const calendar = block.calendarId ? ctx.calendars[block.calendarId] : undefined;
  if (!calendar && ctx.interactive) return null;
  return (
    <section id={ctx.signupBlockId === block.id ? "signup" : undefined} className="scroll-mt-6 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        {(block.heading || block.text) && (
          <div className="mb-6 text-center">
            {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{block.heading}</h2>}
            {block.text && <RichText text={block.text} className={cx("mt-3 text-lg", muted(ctx))} center />}
          </div>
        )}
        <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-lg ring-1 ring-slate-900/5 sm:p-6">
          {!calendar ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              {block.calendarId ? "This booking page is switched off or was deleted." : "Choose a booking page in the block settings."}
            </p>
          ) : ctx.interactive && calendar.time_zone ? (
            <BookingWidget calendar={calendar as PublicCalendar} />
          ) : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                <CalendarDays className="size-4 text-[var(--accent)]" aria-hidden />
                {calendar.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
                {calendar.duration_minutes} min
              </span>
              <span className="w-full text-xs text-slate-400">Visitors pick a free time here.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
