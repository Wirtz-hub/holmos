"use client";

import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { AccentPicker, ButtonTargetInput, ImageInput, Select, TextArea, TextInput, Toggle } from "@/components/funnels/editor/controls";
import { Button } from "@/components/ui";
import { LANGUAGES, type FunnelDoc, type Site, type Step } from "@/lib/funnels/schema";

/** Keeps an address readable while typing; it's tidied up properly when saved. */
const typingSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);

// Shown in the editor when no block is selected: this step's settings, then
// the whole page's look, language and search settings.

export function PageSettings({
  doc,
  stepIndex,
  publicBase,
  onStepChange,
  onDocChange,
  onMoveStep,
  onDeleteStep,
}: {
  doc: FunnelDoc;
  stepIndex: number;
  publicBase: string;
  onStepChange: (step: Step) => void;
  onDocChange: (patch: Partial<FunnelDoc>) => void;
  onMoveStep: (to: number) => void;
  onDeleteStep: () => void;
}) {
  const step = doc.steps[stepIndex];
  const set = (patch: Partial<Step>) => onStepChange({ ...step, ...patch });
  const first = stepIndex === 0;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">This step</h2>
          <p className="text-xs text-slate-500">Click a block on the page to edit it.</p>
        </div>
        <TextInput
          label="Step name"
          value={step.name}
          onChange={(name) => set({ name })}
          hint={doc.site.header.enabled ? "Shown in the menu." : "Only you see this."}
          maxLength={80}
        />
        {doc.site.header.enabled && <Toggle label="Show this step in the menu" checked={step.inMenu} onChange={(inMenu) => set({ inMenu })} />}
        {first ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            The first step is the page&apos;s main address: <span className="font-mono break-all">{publicBase}</span>
          </p>
        ) : (
          <TextInput
            label="Address of this step"
            value={step.slug}
            onChange={(slug) => set({ slug: typingSlug(slug) })}
            hint={<span className="font-mono break-all">{`${publicBase}/${step.slug}`}</span>}
            maxLength={60}
          />
        )}
        <TextInput
          label="Title in Google and browser tabs"
          value={step.seoTitle}
          onChange={(seoTitle) => set({ seoTitle })}
          hint="Leave empty to use the headline."
          maxLength={120}
        />
        <TextArea
          label="Description in Google and when shared"
          rows={2}
          value={step.seoDescription}
          onChange={(seoDescription) => set({ seoDescription })}
          hint="One or two sentences. Leave empty to use the text under the headline."
          maxLength={300}
        />
        {doc.steps.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={first} onClick={() => onMoveStep(stepIndex - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> Move earlier
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={stepIndex === doc.steps.length - 1} onClick={() => onMoveStep(stepIndex + 1)}>
              Move later <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onDeleteStep}>
              <Trash2 className="size-4" aria-hidden /> Delete step
            </Button>
          </div>
        )}
      </section>

      <MenuAndFooter site={doc.site} steps={doc.steps} stepIndex={stepIndex} onChange={(site) => onDocChange({ site })} />

      <section className="space-y-4 border-t border-slate-100 pt-6">
        <h2 className="text-sm font-semibold text-slate-900">Whole page</h2>
        <AccentPicker value={doc.theme.accent} onChange={(accent) => onDocChange({ theme: { ...doc.theme, accent } })} />
        <Select
          label="Background"
          value={doc.theme.background}
          onChange={(background) => onDocChange({ theme: { ...doc.theme, background } })}
          options={[
            { id: "white", label: "White" },
            { id: "soft", label: "Warm off-white" },
            { id: "dark", label: "Dark" },
          ]}
        />
        <Select
          label="Lettering"
          value={doc.theme.font}
          onChange={(font) => onDocChange({ theme: { ...doc.theme, font } })}
          options={[
            { id: "sans", label: "Modern (sans-serif)" },
            { id: "serif", label: "Classic (serif)" },
          ]}
        />
        <Select
          label="Language for buttons and messages"
          value={doc.language}
          onChange={(language) => onDocChange({ language })}
          options={LANGUAGES}
          hint="Used for things you don't write yourself, like “Sending…” and error messages."
        />
        <Toggle
          label="Show this page in Google search results"
          checked={doc.indexable}
          onChange={(indexable) => onDocChange({ indexable })}
          hint="Turn off for pages only meant for ad traffic. Later steps are never shown in Google."
        />
      </section>
    </div>
  );
}

/** A menu along the top and a footer along the bottom turn the page into a website. */
function MenuAndFooter({ site, steps, stepIndex, onChange }: { site: Site; steps: Step[]; stepIndex: number; onChange: (site: Site) => void }) {
  const header = (patch: Partial<Site["header"]>) => onChange({ ...site, header: { ...site.header, ...patch } });
  const footer = (patch: Partial<Site["footer"]>) => onChange({ ...site, footer: { ...site.footer, ...patch } });
  return (
    <section className="space-y-4 border-t border-slate-100 pt-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Menu and footer</h2>
        <p className="text-xs text-slate-500">Turn these on for a full website with several pages. Leave them off for a landing page.</p>
      </div>
      <Toggle label="Show a menu at the top" checked={site.header.enabled} onChange={(enabled) => header({ enabled })} />
      {site.header.enabled && (
        <div className="space-y-4 rounded-lg border border-slate-200 p-3">
          <TextInput label="Business name" value={site.header.businessName} onChange={(businessName) => header({ businessName })} maxLength={120} />
          <ImageInput label="Logo" value={site.header.logoUrl} onChange={(logoUrl) => header({ logoUrl })} hint="Optional. Shown instead of, or next to, the name." />
          <TextInput label="Button in the menu" value={site.header.buttonLabel} onChange={(buttonLabel) => header({ buttonLabel })} hint="e.g. “Book tid”. Leave empty for none." maxLength={60} />
          {site.header.buttonLabel && <ButtonTargetInput value={site.header.button} onChange={(button) => header({ button })} steps={steps} stepIndex={stepIndex} />}
        </div>
      )}
      <Toggle label="Show a footer at the bottom" checked={site.footer.enabled} onChange={(enabled) => footer({ enabled })} />
      {site.footer.enabled && (
        <div className="space-y-4 rounded-lg border border-slate-200 p-3">
          <TextArea label="Text" rows={3} value={site.footer.text} onChange={(text) => footer({ text })} hint="e.g. address and CVR number." maxLength={1000} />
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Phone" value={site.footer.phone} onChange={(phone) => footer({ phone })} maxLength={40} />
            <TextInput label="Email" value={site.footer.email} onChange={(email) => footer({ email })} maxLength={200} />
          </div>
        </div>
      )}
    </section>
  );
}
