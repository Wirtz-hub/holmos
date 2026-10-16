import { ChevronDown, Clock, Mail, MapPin, Phone } from "lucide-react";
import { AccentButton, dark, FormPreview, muted, Picture, RichText, SectionIntro, ServiceIconView, type FunnelContext } from "@/components/funnels/funnel-parts";
import { PublicForm } from "@/components/public/public-form";
import { cx } from "@/components/ui";
import { buttonHref, type BlockOf } from "@/lib/funnels/schema";
import { publicText } from "@/lib/public-text";

// The blocks that make a full website: services, text beside a picture,
// questions, prices, team, contact, gallery and key figures.

const section = "px-4 py-12 @2xl:px-6 @2xl:py-16";
const card = (ctx: FunnelContext) => (dark(ctx) ? "bg-white/5 ring-1 ring-white/10" : "bg-white shadow-sm ring-1 ring-slate-900/5");

export function FeaturesBlock({ block, ctx }: { block: BlockOf<"features">; ctx: FunnelContext }) {
  return (
    <section className={section}>
      <div className="mx-auto max-w-6xl">
        <SectionIntro heading={block.heading} text={block.text} ctx={ctx} />
        <div className={cx("grid gap-5 @2xl:grid-cols-2", block.columns === 3 && "@5xl:grid-cols-3")}>
          {block.items.map((item, i) => (
            <div key={i} className={cx("rounded-2xl p-6", card(ctx))}>
              <span className="grid size-11 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}>
                <ServiceIconView icon={item.icon} className="size-5 text-[var(--accent)]" />
              </span>
              {item.title && <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>}
              {item.text && <RichText text={item.text} className={cx("mt-2 text-base leading-relaxed", muted(ctx))} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SplitBlock({ block, ctx }: { block: BlockOf<"split">; ctx: FunnelContext }) {
  const href = buttonHref(ctx.doc, ctx.stepIndex, block.button, ctx.basePath);
  const picture = block.imageUrl ? (
    <Picture src={block.imageUrl} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-md" />
  ) : ctx.interactive ? null : (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed border-current/20 text-sm opacity-60">No picture chosen yet</div>
  );
  return (
    <section className={section}>
      <div className={cx("mx-auto grid max-w-6xl items-center gap-10", picture ? "@3xl:grid-cols-2" : "max-w-3xl")}>
        <div className={cx(block.imageSide === "left" && "@3xl:order-2")}>
          {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
          {block.text && <RichText text={block.text} className={cx("mt-4 text-lg leading-relaxed", muted(ctx))} />}
          {block.buttonLabel && (
            <div className="mt-7">
              <AccentButton href={href}>{block.buttonLabel}</AccentButton>
            </div>
          )}
        </div>
        {picture && <div className={cx(block.imageSide === "left" && "@3xl:order-1")}>{picture}</div>}
      </div>
    </section>
  );
}

export function FaqBlock({ block, ctx }: { block: BlockOf<"faq">; ctx: FunnelContext }) {
  return (
    <section className={section}>
      <div className="mx-auto max-w-3xl">
        <SectionIntro heading={block.heading} ctx={ctx} />
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <details key={i} className={cx("group rounded-xl px-5 py-4", card(ctx))}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown className="size-5 shrink-0 text-[var(--accent)] transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              {item.answer && <RichText text={item.answer} className={cx("mt-3 leading-relaxed", muted(ctx))} />}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingBlock({ block, ctx }: { block: BlockOf<"pricing">; ctx: FunnelContext }) {
  const text = publicText(ctx.doc.language);
  const count = block.plans.length;
  return (
    <section className={section}>
      <div className="mx-auto max-w-6xl">
        <SectionIntro heading={block.heading} text={block.text} ctx={ctx} />
        <div className={cx("mx-auto grid gap-5", count <= 1 ? "max-w-md" : count === 2 ? "max-w-3xl @3xl:grid-cols-2" : count === 3 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-2 @5xl:grid-cols-4")}>
          {block.plans.map((plan, i) => (
            <div
              key={i}
              className={cx("relative flex flex-col rounded-2xl p-6", card(ctx), plan.highlighted && "ring-2 ring-[var(--accent)]")}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  {text.popular}
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-3">
                <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                {plan.period && <span className={cx("ml-1 text-sm", muted(ctx))}>{plan.period}</span>}
              </p>
              {plan.description && <p className={cx("mt-2 text-sm", muted(ctx))}>{plan.description}</p>}
              {plan.features && <RichText text={plan.features} className={cx("mt-5 flex-1 text-sm", muted(ctx))} />}
              {plan.buttonLabel && (
                <div className="mt-6">
                  <AccentButton href={buttonHref(ctx.doc, ctx.stepIndex, plan.button, ctx.basePath)}>{plan.buttonLabel}</AccentButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TeamBlock({ block, ctx }: { block: BlockOf<"team">; ctx: FunnelContext }) {
  return (
    <section className={section}>
      <div className="mx-auto max-w-6xl">
        <SectionIntro heading={block.heading} text={block.text} ctx={ctx} />
        <div className="flex flex-wrap justify-center gap-y-8">
          {block.people.map((person, i) => (
            <div key={i} className="w-1/2 px-2 text-center @3xl:w-1/3 @5xl:w-1/4">
              {person.photoUrl ? (
                <Picture src={person.photoUrl} alt={person.name} className="mx-auto aspect-square w-28 rounded-full object-cover shadow-md @2xl:w-40" />
              ) : (
                <div
                  className="mx-auto grid aspect-square w-28 place-items-center rounded-full text-2xl font-semibold @2xl:w-40 @2xl:text-3xl"
                  style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                  aria-hidden
                >
                  {person.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <h3 className="mt-4 font-semibold @2xl:text-lg">{person.name}</h3>
              {person.role && <p className="text-sm text-[var(--accent)]">{person.role}</p>}
              {person.bio && <p className={cx("mt-2 text-sm", muted(ctx))}>{person.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactBlock({ block, ctx }: { block: BlockOf<"contact">; ctx: FunnelContext }) {
  const text = publicText(ctx.doc.language);
  const form = block.formId ? ctx.forms[block.formId] : undefined;
  const showForm = Boolean(form) || !ctx.interactive;
  const rows = [
    block.address && { icon: MapPin, label: text.address, value: block.address },
    block.phone && { icon: Phone, label: text.phone, value: block.phone, href: `tel:${block.phone.replace(/\s/g, "")}` },
    block.email && { icon: Mail, label: text.email, value: block.email, href: `mailto:${block.email}` },
    block.openingHours && { icon: Clock, label: text.openingHours, value: block.openingHours },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string; href?: string }[];

  return (
    <section id={ctx.signupBlockId === block.id ? "signup" : undefined} className={cx(section, "scroll-mt-20")}>
      <div className={cx("mx-auto grid max-w-6xl gap-10", showForm && "@3xl:grid-cols-2")}>
        <div>
          {block.heading && <h2 className="text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
          {block.text && <RichText text={block.text} className={cx("mt-3 text-lg", muted(ctx))} />}
          <dl className="mt-8 space-y-5">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}>
                  <row.icon className="size-5 text-[var(--accent)]" aria-hidden />
                </span>
                <div>
                  <dt className={cx("text-sm", muted(ctx))}>{row.label}</dt>
                  <dd className="font-medium whitespace-pre-line">
                    {row.href ? (
                      <a href={row.href} className="hover:text-[var(--accent)]">
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          {block.showMap && block.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.address)}`}
              target="_blank"
              rel="noopener"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              <MapPin className="size-4" aria-hidden />
              {text.directions}
            </a>
          )}
        </div>
        {showForm && (
          <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-lg ring-1 ring-slate-900/5 @2xl:p-8">
            {!form ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                {block.formId ? "This form is switched off or was deleted." : "Choose a form in the block settings, or leave it empty for no form."}
              </p>
            ) : ctx.interactive && "success_message" in form ? (
              <PublicForm form={form} />
            ) : (
              <FormPreview fields={form.fields} submitLabel={form.submit_label} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function GalleryBlock({ block, ctx }: { block: BlockOf<"gallery">; ctx: FunnelContext }) {
  const images = block.images.filter((image) => image.url);
  if (images.length === 0 && ctx.interactive) return null;
  return (
    <section className={section}>
      <div className="mx-auto max-w-6xl">
        {block.heading && <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
        {images.length === 0 ? (
          <div className="grid h-40 place-items-center rounded-2xl border-2 border-dashed border-current/20 text-sm opacity-60">No pictures chosen yet</div>
        ) : (
          <div className={cx("grid grid-cols-2 gap-3", block.columns === 3 && "@3xl:grid-cols-3", block.columns === 4 && "@3xl:grid-cols-4")}>
            {images.map((image, i) => (
              <Picture key={i} src={image.url} alt={image.alt} className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function StatsBlock({ block, ctx }: { block: BlockOf<"stats">; ctx: FunnelContext }) {
  return (
    <section className={section}>
      <div className="mx-auto max-w-5xl">
        {block.heading && <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-balance @2xl:text-3xl">{block.heading}</h2>}
        {/* Wrapping rows are centred, so an odd one out sits in the middle. */}
        <div className="flex flex-wrap justify-center gap-y-6 text-center">
          {block.items.map((item, i) => (
            <div key={i} className={cx("w-1/2 px-2", block.items.length === 4 ? "@3xl:w-1/4" : block.items.length >= 3 && "@3xl:w-1/3")}>
              <p className="text-4xl font-bold tracking-tight text-[var(--accent)] @2xl:text-5xl">{item.value}</p>
              <p className={cx("mt-2 text-sm @2xl:text-base", muted(ctx))}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
