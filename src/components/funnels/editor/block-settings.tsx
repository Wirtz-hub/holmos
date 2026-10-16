"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { ButtonTargetInput, ImageInput, Select, TextArea, TextInput } from "@/components/funnels/editor/controls";
import {
  ContactSettings,
  FaqSettings,
  FeaturesSettings,
  GallerySettings,
  PricingSettings,
  SplitSettings,
  StatsSettings,
  TeamSettings,
} from "@/components/funnels/editor/website-block-settings";
import { BLOCK_LABELS, type Block, type BlockOf, type PhotoCredit, type Step } from "@/lib/funnels/schema";

// The settings panel for whichever block is selected in the page editor.

export type EditorForm = { id: string; name: string; is_active: boolean; client_id: string | null };
export type EditorCalendar = { id: string; name: string; is_active: boolean };

export type BlockSettingsProps<T extends Block["type"]> = {
  block: BlockOf<T>;
  onChange: (block: BlockOf<T>) => void;
  steps: Step[];
  stepIndex: number;
  forms: EditorForm[];
  calendars: EditorCalendar[];
  /** Who the page belongs to, to spot a form that sends people somewhere else. */
  owner: { clientId: string | null; clients: { id: string; name: string }[] };
  /** Records who took a stock photo, so the page can credit them. */
  onCredit: (credit: PhotoCredit) => void;
};
type Props<T extends Block["type"]> = BlockSettingsProps<T>;

const TEXT_HINT = "Leave an empty line between paragraphs. Start lines with “- ” for a bullet list.";

export function BlockSettings(props: Props<Block["type"]>) {
  const { block } = props;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{BLOCK_LABELS[block.type].label}</h2>
        <p className="text-xs text-slate-500">{BLOCK_LABELS[block.type].hint}</p>
      </div>
      {block.type === "hero" && <HeroSettings {...(props as Props<"hero">)} />}
      {block.type === "text" && <TextSettings {...(props as Props<"text">)} />}
      {block.type === "image" && <ImageSettings {...(props as Props<"image">)} />}
      {block.type === "form" && <FormSettings {...(props as Props<"form">)} />}
      {block.type === "cta" && <CtaSettings {...(props as Props<"cta">)} />}
      {block.type === "testimonials" && <TestimonialSettings {...(props as Props<"testimonials">)} />}
      {block.type === "booking" && <BookingSettings {...(props as Props<"booking">)} />}
      {block.type === "features" && <FeaturesSettings {...(props as Props<"features">)} />}
      {block.type === "split" && <SplitSettings {...(props as Props<"split">)} />}
      {block.type === "faq" && <FaqSettings {...(props as Props<"faq">)} />}
      {block.type === "pricing" && <PricingSettings {...(props as Props<"pricing">)} />}
      {block.type === "team" && <TeamSettings {...(props as Props<"team">)} />}
      {block.type === "contact" && <ContactSettings {...(props as Props<"contact">)} />}
      {block.type === "gallery" && <GallerySettings {...(props as Props<"gallery">)} />}
      {block.type === "stats" && <StatsSettings {...(props as Props<"stats">)} />}
    </div>
  );
}

function HeroSettings({ block, onChange, steps, stepIndex, onCredit }: Props<"hero">) {
  const set = (patch: Partial<BlockOf<"hero">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Small text above the headline" value={block.eyebrow} onChange={(eyebrow) => set({ eyebrow })} hint="Optional, e.g. “Free guide”" maxLength={120} />
      <TextArea label="Headline" rows={2} value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text under the headline" value={block.text} onChange={(text) => set({ text })} hint={TEXT_HINT} maxLength={1000} />
      <TextInput label="Button text" value={block.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} hint="Leave empty for no button." maxLength={60} />
      {block.buttonLabel && <ButtonTargetInput value={block.button} onChange={(button) => set({ button })} steps={steps} stepIndex={stepIndex} />}
      <ImageInput label="Picture" value={block.imageUrl} onChange={(imageUrl) => set({ imageUrl })} onCredit={onCredit} hint="Optional. Landscape pictures work best." />
      {block.imageUrl && (
        <Select
          label="Layout"
          value={block.layout}
          onChange={(layout) => set({ layout })}
          options={[
            { id: "center", label: "Centred, picture below" },
            { id: "split", label: "Text left, picture right" },
            { id: "background", label: "Picture behind the text" },
          ]}
        />
      )}
    </>
  );
}

function TextSettings({ block, onChange }: Props<"text">) {
  const set = (patch: Partial<BlockOf<"text">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} hint="Optional" maxLength={200} />
      <TextArea label="Text" rows={8} value={block.text} onChange={(text) => set({ text })} hint={TEXT_HINT} maxLength={10000} />
      <Select
        label="Alignment"
        value={block.align}
        onChange={(align) => set({ align })}
        options={[
          { id: "left", label: "Left" },
          { id: "center", label: "Centred" },
        ]}
      />
    </>
  );
}

function ImageSettings({ block, onChange, onCredit }: Props<"image">) {
  const set = (patch: Partial<BlockOf<"image">>) => onChange({ ...block, ...patch });
  return (
    <>
      <ImageInput label="Picture" value={block.url} onChange={(url) => set({ url })} onCredit={onCredit} />
      <TextInput label="Describe the picture" value={block.alt} onChange={(alt) => set({ alt })} hint="Read aloud to blind visitors, and used by Google." maxLength={300} />
      <TextInput label="Caption" value={block.caption} onChange={(caption) => set({ caption })} hint="Optional" maxLength={300} />
      <Select
        label="Size"
        value={block.size}
        onChange={(size) => set({ size })}
        options={[
          { id: "medium", label: "Medium" },
          { id: "wide", label: "Wide" },
          { id: "full", label: "Full width, edge to edge" },
        ]}
      />
    </>
  );
}

function FormSettings({ block, onChange, forms, steps, stepIndex, owner }: Props<"form">) {
  const set = (patch: Partial<BlockOf<"form">>) => onChange({ ...block, ...patch });
  const isLast = stepIndex === steps.length - 1;
  const ownerName = (clientId: string | null) => (clientId ? (owner.clients.find((c) => c.id === clientId)?.name ?? "a client") : "HolmNordic");
  const chosen = forms.find((f) => f.id === block.formId);
  const mismatch = chosen && (chosen.client_id ?? null) !== (owner.clientId ?? null);
  return (
    <>
      <Select
        label="Which form"
        value={block.formId ?? ""}
        onChange={(formId) => set({ formId: formId || null })}
        options={[
          { id: "", label: "Choose a form…" },
          ...forms.map((f) => ({ id: f.id, label: `${f.name} · ${ownerName(f.client_id)}${f.is_active ? "" : " (switched off)"}` })),
        ]}
        hint={
          <>
            Change its questions on the{" "}
            <Link href={block.formId ? `/forms/${block.formId}` : "/forms"} target="_blank" className="text-brand-700 underline">
              Forms page
            </Link>
            .
          </>
        }
      />
      {mismatch && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          This page belongs to <strong>{ownerName(owner.clientId)}</strong>, but answers to this form go to{" "}
          <strong>{chosen.client_id ? `the contact list of ${ownerName(chosen.client_id)}` : "your own pipeline"}</strong>. Pick a form that
          belongs to the same one, or change who the form belongs to on the Forms page.
        </p>
      )}
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} hint="Optional" maxLength={200} />
      <TextArea label="Text" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <Select
        label="After sending"
        value={block.afterSubmit}
        onChange={(afterSubmit) => set({ afterSubmit })}
        options={[
          { id: "form", label: "Do what the form says (thank-you message or its own page)" },
          { id: "next", label: isLast ? "Go to the next step (add a step first)" : `Go to the next step (${steps[stepIndex + 1]?.name})` },
        ]}
      />
    </>
  );
}

function CtaSettings({ block, onChange, steps, stepIndex }: Props<"cta">) {
  const set = (patch: Partial<BlockOf<"cta">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextArea label="Heading" rows={2} value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text" rows={3} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <TextInput label="Button text" value={block.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} maxLength={60} />
      {block.buttonLabel && <ButtonTargetInput value={block.button} onChange={(button) => set({ button })} steps={steps} stepIndex={stepIndex} />}
    </>
  );
}

function TestimonialSettings({ block, onChange }: Props<"testimonials">) {
  const items = block.items;
  const setItems = (next: typeof items) => onChange({ ...block, items: next });
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setItems(next);
  };
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => onChange({ ...block, heading })} maxLength={200} />
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Quote {i + 1}</span>
              <div className="flex">
                <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" aria-label="Remove quote">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <TextArea label="What they said" rows={3} value={item.quote} onChange={(quote) => setItems(items.map((it, j) => (j === i ? { ...it, quote } : it)))} maxLength={1000} />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Name" value={item.name} onChange={(name) => setItems(items.map((it, j) => (j === i ? { ...it, name } : it)))} maxLength={120} />
              <TextInput label="Company or role" value={item.role} onChange={(role) => setItems(items.map((it, j) => (j === i ? { ...it, role } : it)))} maxLength={120} />
            </div>
          </li>
        ))}
      </ol>
      {items.length < 12 && (
        <button
          type="button"
          onClick={() => setItems([...items, { quote: "", name: "", role: "" }])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600"
        >
          <Plus className="size-4" aria-hidden /> Add a quote
        </button>
      )}
    </>
  );
}

function BookingSettings({ block, onChange, calendars }: Props<"booking">) {
  const set = (patch: Partial<BlockOf<"booking">>) => onChange({ ...block, ...patch });
  return (
    <>
      <Select
        label="Which booking page"
        value={block.calendarId ?? ""}
        onChange={(calendarId) => set({ calendarId: calendarId || null })}
        options={[{ id: "", label: "Choose a booking page…" }, ...calendars.map((c) => ({ id: c.id, label: c.is_active ? c.name : `${c.name} (switched off)` }))]}
        hint={
          <>
            Set times and length on the{" "}
            <Link href="/bookings" target="_blank" className="text-brand-700 underline">
              Bookings page
            </Link>
            .
          </>
        }
      />
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} hint="Optional" maxLength={200} />
      <TextArea label="Text" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
    </>
  );
}
