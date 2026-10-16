"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { OWNER_HINT, OwnerSelect, type ClientOption } from "@/components/owner-select";
import { Button, Card, CardHeader, Field, inputClass, Notice } from "@/components/ui";
import { checkDomainAction, saveFunnelSettingsAction } from "@/lib/actions/funnels";
import { normaliseDomain } from "@/lib/hosts";

// The page's name, its address on HolmOS, and an optional custom domain.

export function FunnelSettingsForm({
  funnel,
  clients,
  appAddress,
}: {
  funnel: { id: string; name: string; slug: string; custom_domain: string | null; client_id: string | null };
  clients: ClientOption[];
  /** e.g. "https://holmos.vercel.app" */
  appAddress: string;
}) {
  const [state, formAction, pending] = useActionState(saveFunnelSettingsAction.bind(null, funnel.id), null);
  const [slug, setSlug] = useState(funnel.slug);
  const [domain, setDomain] = useState(funnel.custom_domain ?? "");
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, startChecking] = useTransition();
  const errors = state?.fieldErrors ?? {};
  const clean = normaliseDomain(domain);
  const sub = clean.split(".").length > 2 ? clean.split(".")[0] : "@";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="max-w-3xl space-y-6"
    >
      <Card>
        <CardHeader title="Name and address" />
        <div className="space-y-4 p-5">
          <Field label="Name" htmlFor="name" error={errors.name} hint="Only you see this.">
            <input id="name" name="name" required maxLength={120} defaultValue={funnel.name} className={inputClass} />
          </Field>
          <Field label="Belongs to" htmlFor="client_id" hint={OWNER_HINT}>
            <OwnerSelect clients={clients} defaultValue={funnel.client_id ?? ""} />
          </Field>
          <Field label="Address on HolmOS" htmlFor="slug" error={errors.slug} hint="Changing it breaks links you've already shared or used in ads.">
            <div className="flex items-stretch overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-300 ring-inset focus-within:ring-2 focus-within:ring-brand-500">
              <span className="hidden items-center bg-slate-50 px-3 text-sm text-slate-500 sm:flex">{appAddress.replace(/^https?:\/\//, "")}/f/</span>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))}
                maxLength={60}
                className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your own domain (optional)"
          description="Show this page on an address like tilbud.yourclient.dk instead of the HolmOS address."
        />
        <div className="space-y-4 p-5">
          <Field label="Domain" htmlFor="custom_domain" error={errors.custom_domain} hint="Leave empty to only use the HolmOS address.">
            <input
              id="custom_domain"
              name="custom_domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
              onBlur={() => setDomain(clean)}
              placeholder="tilbud.yourclient.dk"
              className={inputClass}
            />
          </Field>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Pick the address. A <strong>sub-domain</strong> like <span className="font-mono">tilbud.yourclient.dk</span> is easiest: the
              client&apos;s main website stays as it is.
            </li>
            <li>
              In <strong>Vercel</strong>, open the HolmOS project, go to <em>Settings → Domains</em>, press <em>Add Domain</em>, type the domain and
              save. Vercel then shows the DNS record it wants.
            </li>
            <li>
              Where the domain is registered (Simply.com, One.com, GoDaddy and so on), open its <em>DNS</em> settings and add the record Vercel
              showed. Usually that&apos;s:
              <div className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {sub === "@" ? <>Type: A · Name: @ · Value: 76.76.21.21</> : <>Type: CNAME · Name: {sub} · Value: cname.vercel-dns.com</>}
              </div>
            </li>
            <li>Save the domain here. Within an hour or so Vercel shows &quot;Valid Configuration&quot; and the page works there, with a padlock (https).</li>
          </ol>
          {clean && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={checking}
                onClick={() => startChecking(async () => setCheck(await checkDomainAction(clean)))}
              >
                {checking ? "Checking…" : "Check the domain"}
              </Button>
              {check && <span className={check.ok ? "text-sm text-emerald-700" : "text-sm text-amber-700"}>{check.message}</span>}
            </div>
          )}
        </div>
      </Card>

      {state && !state.ok && state.message && <Notice kind="error">{state.message}</Notice>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state?.ok && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </form>
  );
}
