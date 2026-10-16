"use client";

import { CalendarDays, ClipboardList, File, Gift, Globe, LoaderCircle, Sparkles } from "lucide-react";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { ServiceIconView } from "@/components/funnels/funnel-parts";
import { OWNER_HINT, OwnerSelect, type ClientOption } from "@/components/owner-select";
import { Button, Card, cx, Field, inputClass, Notice } from "@/components/ui";
import { createFunnelAction, generateWebsiteAction } from "@/lib/actions/funnels";
import type { ServiceIcon } from "@/lib/funnels/schema";

const ICONS: Record<string, typeof File> = { lead: ClipboardList, booking: CalendarDays, offer: Gift, blank: File };

type Template = { id: string; name: string; description: string; steps: number };
type WebsiteTemplate = { id: string; name: string; icon: ServiceIcon };
type Mode = "landing" | "website" | "ai";

const MODES: { id: Mode; label: string; icon: typeof File; description: string }[] = [
  { id: "landing", label: "Landing page", icon: ClipboardList, description: "One focused page for a campaign: collect leads or bookings." },
  { id: "website", label: "Website", icon: Globe, description: "A full website with front page, services, about and contact, written for a trade." },
  { id: "ai", label: "Write it with AI", icon: Sparkles, description: "AI writes a made-to-measure website from a short description and the client's current site." },
];

const TONES = [
  { id: "friendly", label: "Friendly and personal" },
  { id: "professional", label: "Professional and reassuring" },
  { id: "premium", label: "Exclusive and premium" },
  { id: "energetic", label: "Energetic and motivating" },
];

export function NewFunnelForm({
  templates,
  websiteTemplates,
  clients,
  defaultClientId,
  ai,
  photos,
}: {
  templates: Template[];
  websiteTemplates: WebsiteTemplate[];
  clients: ClientOption[];
  defaultClientId: string;
  ai: { claude: boolean; gemini: boolean };
  photos: boolean;
}) {
  const [createState, createAction, creating] = useActionState(createFunnelAction, null);
  const [aiState, aiAction, writing] = useActionState(generateWebsiteAction, null);
  const [mode, setMode] = useState<Mode>("landing");
  const [template, setTemplate] = useState(templates[0].id);
  const [siteTemplate, setSiteTemplate] = useState(websiteTemplates[0].id);
  const [provider, setProvider] = useState<"claude" | "gemini">(ai.gemini || !ai.claude ? "gemini" : "claude");

  // The business name follows the chosen client until it's typed in by hand.
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
  const [businessName, setBusinessName] = useState(nameOf(defaultClientId));
  const [nameTyped, setNameTyped] = useState(false);

  const pending = creating || writing;
  const state = mode === "ai" ? aiState : createState;
  const site = mode !== "landing";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => (mode === "ai" ? aiAction(formData) : createAction(formData)));
      }}
      className="max-w-4xl space-y-6"
    >
      <div role="radiogroup" aria-label="What do you want to make?" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.id)}
              className={cx(
                "flex gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors",
                active ? "border-brand-500 ring-2 ring-brand-500" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className={cx("grid size-10 shrink-0 place-items-center rounded-lg", active ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700")}>
                <m.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{m.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "landing" && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-slate-700">Template</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => {
              const Icon = ICONS[t.id] ?? File;
              return (
                <Choice key={t.id} name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                    <span className="mt-0.5 block text-sm text-slate-500">{t.description}</span>
                    <span className="mt-1 block text-xs text-slate-400">{t.steps === 1 ? "1 step" : `${t.steps} steps`}</span>
                  </span>
                </Choice>
              );
            })}
          </div>
        </fieldset>
      )}

      {mode === "website" && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Trade</legend>
          <p className="mb-3 text-sm text-slate-500">Four pages with Danish starter text, pictures, a menu and a contact form. Change anything afterwards.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {websiteTemplates.map((t) => (
              <Choice key={t.id} name="template" value={t.id} checked={siteTemplate === t.id} onChange={() => setSiteTemplate(t.id)} compact>
                <ServiceIconView icon={t.icon} className="size-5 shrink-0 text-brand-700" />
                <span className="text-sm font-medium text-slate-900">{t.name}</span>
              </Choice>
            ))}
          </div>
        </fieldset>
      )}

      {mode === "ai" && (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">About the business</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              The AI only writes facts you give it or that are on the current website. It never makes up reviews, prices or numbers.
            </p>
          </div>
          <Field label="Current website" htmlFor="website" hint="Optional. The AI reads it and reuses the facts, prices, contact details and colours.">
            <input id="website" name="website" type="text" inputMode="url" maxLength={500} className={inputClass} placeholder="e.g. tandlaege-hansen.dk" />
          </Field>
          <Field label="What they do" htmlFor="about" hint="One or two sentences. Can be left empty if the current website says it.">
            <textarea id="about" name="about" rows={2} maxLength={1000} className={inputClass} placeholder="e.g. Family dental clinic with extra time for anxious patients." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Town or area" htmlFor="city">
              <input id="city" name="city" maxLength={120} className={inputClass} placeholder="e.g. Aarhus C" />
            </Field>
            <Field label="Ideal customers" htmlFor="audience" hint="Optional">
              <input id="audience" name="audience" maxLength={500} className={inputClass} placeholder="e.g. families with children" />
            </Field>
          </div>
          <Field
            label="Services, prices and other facts"
            htmlFor="services"
            hint="Everything the AI may use: services, prices, opening hours, address, phone, CVR, years in business."
          >
            <textarea id="services" name="services" rows={5} maxLength={3000} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tone" htmlFor="tone">
              <select id="tone" name="tone" defaultValue="friendly" className={inputClass}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Other wishes" htmlFor="extra" hint="Optional">
              <input id="extra" name="extra" maxLength={1000} className={inputClass} placeholder="e.g. mention free parking" />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Which AI writes it?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice name="provider" value="gemini" checked={provider === "gemini"} onChange={() => setProvider("gemini")} disabled={!ai.gemini}>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Gemini (Google)</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {ai.gemini ? "Free within Google's daily limit. Google may use what you send to improve its products." : "Not set up yet: add GEMINI_API_KEY (see SETUP.md)."}
                  </span>
                </span>
              </Choice>
              <Choice name="provider" value="claude" checked={provider === "claude"} onChange={() => setProvider("claude")} disabled={!ai.claude}>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Claude (Anthropic)</span>
                  <span className="mt-0.5 block text-sm text-slate-500">
                    {ai.claude ? "The best writing. Costs about 1–3 kr. per website, paid to Anthropic." : "Not set up yet: add ANTHROPIC_API_KEY (see SETUP.md)."}
                  </span>
                </span>
              </Choice>
            </div>
          </fieldset>
        </Card>
      )}

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        {site && (
          <Field label="Business name" htmlFor="business_name" hint="Shown in the menu, footer and text.">
            <input
              id="business_name"
              name="business_name"
              required={mode === "website"}
              maxLength={120}
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                setNameTyped(true);
              }}
              className={inputClass}
              placeholder={mode === "ai" ? "Leave empty to take it from the website" : "e.g. Tandlæge Hansen"}
            />
          </Field>
        )}
        <Field label="Belongs to" htmlFor="client_id" hint={OWNER_HINT} className={cx(!site && "sm:row-span-2")}>
          <OwnerSelect
            clients={clients}
            defaultValue={defaultClientId}
            onChange={(id) => {
              if (!nameTyped) setBusinessName(nameOf(id));
            }}
          />
        </Field>
        <Field
          label="Name"
          htmlFor="name"
          hint={site ? "Optional. Only you see it; it also becomes the address. Empty = the business name." : "Only you see this. It also becomes the page's address."}
        >
          <input id="name" name="name" required={!site} maxLength={120} className={inputClass} placeholder={site ? businessName || "e.g. Website" : "e.g. Spring campaign"} />
        </Field>
        {mode === "website" ? (
          <input type="hidden" name="language" value="da" />
        ) : (
          <Field label="Language visitors see" htmlFor="language" hint={mode === "ai" ? "The AI writes in this language." : "For the template's text, buttons and messages."}>
            <select id="language" name="language" defaultValue="da" className={inputClass}>
              <option value="da">Danish</option>
              <option value="en">English</option>
            </select>
          </Field>
        )}
      </Card>

      {site && !photos && (
        <Notice kind="warning">Photo search isn&apos;t set up yet, so the website starts without pictures. SETUP.md explains how to add a free Unsplash key.</Notice>
      )}
      {state && !state.ok && state.message && <Notice kind="error">{state.message}</Notice>}
      {writing && (
        <Notice>
          <span className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Writing the website. This usually takes 1–2 minutes; keep this page open.
          </span>
        </Notice>
      )}
      <Button type="submit" disabled={pending || (mode === "ai" && !ai[provider])}>
        {mode === "ai" ? (writing ? "Writing…" : "Write the website") : creating ? "Creating…" : mode === "website" ? "Create website" : "Create page"}
      </Button>
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  disabled,
  compact,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex rounded-xl border bg-white shadow-sm transition-colors",
        compact ? "items-center gap-2 p-3" : "gap-3 p-4",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked && !disabled ? "border-brand-500 ring-2 ring-brand-500" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked && !disabled} onChange={onChange} disabled={disabled} className="sr-only" />
      {children}
    </label>
  );
}
