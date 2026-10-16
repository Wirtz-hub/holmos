import { CalendarDays, Clock, Quote } from "lucide-react";
import type { ReactNode } from "react";
import { AccentButton, dark, FormPreview, muted, Picture, RichText, themeStyle, type FunnelContext } from "@/components/funnels/funnel-parts";
import { SiteFooter, SiteHeader } from "@/components/funnels/site-chrome";
import {
  ContactBlock,
  FaqBlock,
  FeaturesBlock,
  GalleryBlock,
  PricingBlock,
  SplitBlock,
  StatsBlock,
  TeamBlock,
} from "@/components/funnels/website-blocks";
import { BookingWidget } from "@/components/public/booking-widget";
import { PublicForm } from "@/components/public/public-form";
import { cx } from "@/components/ui";
import { buttonHref, nextStepHref, type Block, type BlockOf, type FunnelDoc } from "@/lib/funnels/schema";
import type { PublicCalendar } from "@/lib/public-data";

export { FormPreview, RichText, themeStyle, type FunnelContext };

// Renders landing page blocks. Shared by the public pages (interactive forms
// and booking) and the editor (static previews), so it has no hooks of its own.

export function FunnelFrame({ doc, children, className }: { doc: FunnelDoc; children: ReactNode; className?: string }) {
  const { background, font } = doc.theme;
  return (
    <div
      lang={doc.language}
      style={themeStyle(doc)}
      className={cx(
        // Blocks respond to this frame's width (@2xl:, @3xl:…), so the editor canvas matches the live page.
        "@container",
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
  return blocks.find((b) => b.type === "form" || b.type === "booking" || (b.type === "contact" && b.formId))?.id ?? null;
}

export function FunnelStepView({ ctx }: { ctx: FunnelContext }) {
  const step = ctx.doc.steps[ctx.stepIndex];
  return (
    <FunnelFrame doc={ctx.doc} className="flex min-h-dvh flex-col">
      <SiteHeader ctx={ctx} />
      <main className="flex-1">
        {step.blocks.map((block) => (
          <BlockView key={block.id} block={block} ctx={ctx} />
        ))}
      </main>
      <SiteFooter ctx={ctx} />
    </FunnelFrame>
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
    case "features":
      return <FeaturesBlock block={block} ctx={ctx} />;
    case "split":
      return <SplitBlock block={block} ctx={ctx} />;
    case "faq":
      return <FaqBlock block={block} ctx={ctx} />;
    case "pricing":
      return <PricingBlock block={block} ctx={ctx} />;
    case "team":
      return <TeamBlock block={block} ctx={ctx} />;
    case "contact":
      return <ContactBlock block={block} ctx={ctx} />;
    case "gallery":
      return <GalleryBlock block={block} ctx={ctx} />;
    case "stats":
      return <StatsBlock block={block} ctx={ctx} />;
  }
}

function HeroBlock({ block, ctx }: { block: BlockOf<"hero">; ctx: FunnelContext }) {
  const href = buttonHref(ctx.doc, ctx.stepIndex, block.button, ctx.basePath);
  const split = block.layout === "split" && block.imageUrl;
  if (block.layout === "background") {
    return (
      <section className="relative isolate overflow-hidden bg-slate-900 px-4 py-24 text-white @2xl:px-6 @2xl:py-32">
        {block.imageUrl && <Picture src={block.imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />}
        <div className="mx-auto max-w-3xl text-center">
          {block.eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide uppercase opacity-90">{block.eyebrow}</p>}
          {block.heading && <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance @2xl:text-5xl">{block.heading}</h1>}
          {block.text && <RichText text={block.text} className="mt-5 text-lg leading-relaxed text-white/90" center />}
          {block.buttonLabel && (
            <div className="mt-8">
              <AccentButton href={href} large>
                {block.buttonLabel}
              </AccentButton>
            </div>
          )}
        </div>
      </section>
    );
  }
  return (
    <section className="px-4 py-14 @2xl:px-6 @2xl:py-20" style={{ background: "color-mix(in srgb, var(--accent) 9%, transparent)" }}>
      <div className={cx("mx-auto max-w-6xl", split ? "grid items-center gap-10 @3xl:grid-cols-2" : "text-center")}>
        <div className={cx(!split && "mx-auto max-w-3xl")}>
          {block.eyebrow && <p className="mb-3 text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">{block.eyebrow}</p>}
          {block.heading && <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance @2xl:text-5xl">{block.heading}</h1>}
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
          <Picture src={block.imageUrl} alt="" className={cx("w-full rounded-2xl object-cover shadow-lg", split ? "aspect-[4/3]" : "mx-auto mt-12 max-w-4xl")} />
        )}
      </div>
    </section>
  );
}

function TextBlock({ block, ctx }: { block: BlockOf<"text">; ctx: FunnelContext }) {
  const center = block.align === "center";
  return (
    <section className="px-4 py-10 @2xl:px-6 @2xl:py-14">
      <div className={cx("mx-auto max-w-3xl", center && "text-center")}>
        {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
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
    <figure className={cx(full ? "py-8" : "px-4 py-8 @2xl:px-6")}>
      <Picture
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
    <section id={ctx.signupBlockId === block.id ? "signup" : undefined} className="scroll-mt-6 px-4 py-10 @2xl:px-6 @2xl:py-14">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-slate-900 shadow-lg ring-1 ring-slate-900/5 @2xl:p-8">
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

function CtaBlock({ block, ctx }: { block: BlockOf<"cta">; ctx: FunnelContext }) {
  const href = buttonHref(ctx.doc, ctx.stepIndex, block.button, ctx.basePath);
  return (
    <section className="px-4 py-10 @2xl:px-6 @2xl:py-14">
      <div className="mx-auto max-w-4xl rounded-3xl px-6 py-10 text-center @2xl:px-12 @2xl:py-14" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
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
    <section className="px-4 py-10 @2xl:px-6 @2xl:py-14">
      <div className="mx-auto max-w-6xl">
        {block.heading && <h2 className="text-center text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
        <div className={cx("mt-8 grid gap-5", block.items.length === 1 ? "mx-auto max-w-2xl" : block.items.length === 2 ? "@3xl:grid-cols-2" : "@3xl:grid-cols-2 @5xl:grid-cols-3")}>
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
    <section id={ctx.signupBlockId === block.id ? "signup" : undefined} className="scroll-mt-6 px-4 py-10 @2xl:px-6 @2xl:py-14">
      <div className="mx-auto max-w-3xl">
        {(block.heading || block.text) && (
          <div className="mb-6 text-center">
            {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
            {block.text && <RichText text={block.text} className={cx("mt-3 text-lg", muted(ctx))} center />}
          </div>
        )}
        <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-lg ring-1 ring-slate-900/5 @2xl:p-6">
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
