import { Menu } from "lucide-react";
import { AccentButton, dark, muted, Picture, RichText, type FunnelContext } from "@/components/funnels/funnel-parts";
import { cx } from "@/components/ui";
import { buttonHref, stepHref, usedImageUrls } from "@/lib/funnels/schema";
import { publicText } from "@/lib/public-text";

// The menu along the top and the footer along the bottom of a website.

const UNSPLASH_UTM = "utm_source=holmos&utm_medium=referral";

function menuItems(ctx: FunnelContext) {
  return ctx.doc.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.inMenu)
    .map(({ step, index }) => ({ label: step.name, href: stepHref(ctx.doc, index, ctx.basePath), active: index === ctx.stepIndex }));
}

export function SiteHeader({ ctx }: { ctx: FunnelContext }) {
  const { header } = ctx.doc.site;
  if (!header.enabled) return null;
  const text = publicText(ctx.doc.language);
  const items = menuItems(ctx);
  const home = stepHref(ctx.doc, 0, ctx.basePath);
  const cta = header.buttonLabel ? buttonHref(ctx.doc, ctx.stepIndex, header.button, ctx.basePath) : null;

  return (
    <header className={cx("sticky top-0 z-40 border-b backdrop-blur", dark(ctx) ? "border-white/10 bg-slate-950/85" : "border-slate-900/5 bg-white/85")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 @2xl:px-6">
        <a href={home} className="flex min-w-0 items-center gap-2.5">
          {header.logoUrl && <Picture src={header.logoUrl} alt="" className="h-9 w-auto max-w-[9rem] object-contain" />}
          {(header.businessName || !header.logoUrl) && <span className="truncate text-lg font-bold tracking-tight">{header.businessName || " "}</span>}
        </a>
        <nav className="hidden items-center gap-1 @3xl:flex" aria-label={text.menu}>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cx(
                "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                item.active ? "text-[var(--accent)]" : cx(muted(ctx), "hover:text-[var(--accent)]"),
              )}
            >
              {item.label}
            </a>
          ))}
          {cta && (
            <span className="ml-2">
              <AccentButton href={cta}>{header.buttonLabel}</AccentButton>
            </span>
          )}
        </nav>
        {(items.length > 0 || cta) && (
          // A menu that folds out on phones, without any JavaScript.
          <details className="group relative @3xl:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <Menu className="size-5" aria-hidden />
              {text.menu}
            </summary>
            <div className={cx("absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-xl ring-1", dark(ctx) ? "bg-slate-900 ring-white/10" : "bg-white ring-slate-900/5")}>
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cx("block rounded-xl px-3 py-2.5 text-base font-medium", item.active && "text-[var(--accent)]")}
                >
                  {item.label}
                </a>
              ))}
              {cta && (
                <a
                  href={cta}
                  className="mt-1 block rounded-xl px-3 py-2.5 text-center text-base font-semibold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {header.buttonLabel}
                </a>
              )}
            </div>
          </details>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ ctx }: { ctx: FunnelContext }) {
  const { footer, header } = ctx.doc.site;
  const text = publicText(ctx.doc.language);
  const used = usedImageUrls(ctx.doc);
  // Credit each photographer whose Unsplash photo is still on the page, once.
  const credits = ctx.doc.photoCredits.filter((c) => used.has(c.url)).filter((c, i, all) => all.findIndex((o) => o.name === c.name) === i);
  if (!footer.enabled && credits.length === 0) return null;

  return (
    <footer className={cx("border-t text-sm", dark(ctx) ? "border-white/10" : "border-slate-900/5")}>
      {footer.enabled && (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 @2xl:grid-cols-3 @2xl:px-6">
          <div>
            {header.businessName && <p className="text-base font-bold">{header.businessName}</p>}
            {footer.text && <RichText text={footer.text} className={cx("mt-2", muted(ctx))} />}
          </div>
          <div className={cx("space-y-1", muted(ctx))}>
            {footer.phone && (
              <p>
                <a href={`tel:${footer.phone.replace(/\s/g, "")}`} className="hover:text-[var(--accent)]">
                  {footer.phone}
                </a>
              </p>
            )}
            {footer.email && (
              <p>
                <a href={`mailto:${footer.email}`} className="hover:text-[var(--accent)]">
                  {footer.email}
                </a>
              </p>
            )}
          </div>
          {header.enabled && (
            <nav className={cx("space-y-1", muted(ctx))} aria-label={text.menu}>
              {menuItems(ctx).map((item) => (
                <p key={item.href}>
                  <a href={item.href} className="hover:text-[var(--accent)]">
                    {item.label}
                  </a>
                </p>
              ))}
            </nav>
          )}
        </div>
      )}
      {credits.length > 0 && (
        <p className={cx("mx-auto max-w-6xl px-4 pb-6 text-xs @2xl:px-6", footer.enabled ? "" : "pt-6", muted(ctx))}>
          {/* Unsplash's rule: "Photos by <photographer> on Unsplash", both linked. */}
          {text.photosBy}{" "}
          {credits.map((c, i) => (
            <span key={c.name}>
              {i > 0 && ", "}
              {c.link ? (
                <a href={`${c.link}?${UNSPLASH_UTM}`} target="_blank" rel="noopener" className="underline">
                  {c.name}
                </a>
              ) : (
                c.name
              )}
            </span>
          ))}{" "}
          {text.photosOn}{" "}
          <a href={`https://unsplash.com/?${UNSPLASH_UTM}`} target="_blank" rel="noopener" className="underline">
            Unsplash
          </a>
        </p>
      )}
    </footer>
  );
}
