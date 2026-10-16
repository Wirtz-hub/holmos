"use client";

import { ButtonTargetInput, ImageInput, ListEditor, Select, TextArea, TextInput, Toggle } from "@/components/funnels/editor/controls";
import type { BlockSettingsProps as Props } from "@/components/funnels/editor/block-settings";
import { ServiceIconView } from "@/components/funnels/funnel-parts";
import { cx } from "@/components/ui";
import { SERVICE_ICONS, type BlockOf, type ServiceIcon } from "@/lib/funnels/schema";

// Settings panels for the website blocks.

const TEXT_HINT = "Leave an empty line between paragraphs. Start lines with “- ” for a bullet list.";

function IconPicker({ value, onChange }: { value: ServiceIcon; onChange: (icon: ServiceIcon) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">Icon</p>
      <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Icon">
        {SERVICE_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            aria-label={icon}
            onClick={() => onChange(icon)}
            className={cx("grid aspect-square place-items-center rounded-md", value === icon ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <ServiceIconView icon={icon} className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeaturesSettings({ block, onChange }: Props<"features">) {
  const set = (patch: Partial<BlockOf<"features">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text under the heading" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <Select
        label="Columns on a computer"
        value={String(block.columns) as "2" | "3"}
        onChange={(columns) => set({ columns: Number(columns) as 2 | 3 })}
        options={[
          { id: "2", label: "2 side by side" },
          { id: "3", label: "3 side by side" },
        ]}
      />
      <ListEditor
        items={block.items}
        onChange={(items) => set({ items })}
        itemLabel={(i) => `Service ${i + 1}`}
        newItem={() => ({ icon: "check" as ServiceIcon, title: "", text: "" })}
        max={12}
        addLabel="Add a service"
      >
        {(item, update) => (
          <>
            <TextInput label="Name" value={item.title} onChange={(title) => update({ title })} maxLength={120} />
            <TextArea label="Description" rows={3} value={item.text} onChange={(text) => update({ text })} maxLength={600} />
            <IconPicker value={item.icon} onChange={(icon) => update({ icon })} />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function SplitSettings({ block, onChange, steps, stepIndex, onCredit }: Props<"split">) {
  const set = (patch: Partial<BlockOf<"split">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextArea label="Heading" rows={2} value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text" rows={6} value={block.text} onChange={(text) => set({ text })} hint={TEXT_HINT} maxLength={3000} />
      <ImageInput label="Picture" value={block.imageUrl} onChange={(imageUrl) => set({ imageUrl })} onCredit={onCredit} />
      <Select
        label="Picture on the"
        value={block.imageSide}
        onChange={(imageSide) => set({ imageSide })}
        options={[
          { id: "right", label: "Right" },
          { id: "left", label: "Left" },
        ]}
      />
      <TextInput label="Button text" value={block.buttonLabel} onChange={(buttonLabel) => set({ buttonLabel })} hint="Leave empty for no button." maxLength={60} />
      {block.buttonLabel && <ButtonTargetInput value={block.button} onChange={(button) => set({ button })} steps={steps} stepIndex={stepIndex} />}
    </>
  );
}

export function FaqSettings({ block, onChange }: Props<"faq">) {
  const set = (patch: Partial<BlockOf<"faq">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <ListEditor
        items={block.items}
        onChange={(items) => set({ items })}
        itemLabel={(i) => `Question ${i + 1}`}
        newItem={() => ({ question: "", answer: "" })}
        max={20}
        addLabel="Add a question"
      >
        {(item, update) => (
          <>
            <TextInput label="Question" value={item.question} onChange={(question) => update({ question })} maxLength={300} />
            <TextArea label="Answer" rows={3} value={item.answer} onChange={(answer) => update({ answer })} maxLength={2000} />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function PricingSettings({ block, onChange, steps, stepIndex }: Props<"pricing">) {
  const set = (patch: Partial<BlockOf<"pricing">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text under the heading" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <ListEditor
        items={block.plans}
        onChange={(plans) => set({ plans })}
        itemLabel={(i) => `Package ${i + 1}`}
        newItem={() => ({
          name: "",
          price: "",
          period: "",
          description: "",
          features: "",
          buttonLabel: "",
          button: { target: "form" as const, stepId: "", url: "" },
          highlighted: false,
        })}
        max={4}
        addLabel="Add a package"
      >
        {(plan, update) => (
          <>
            <TextInput label="Name" value={plan.name} onChange={(name) => update({ name })} maxLength={80} />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Price" value={plan.price} onChange={(price) => update({ price })} placeholder="499 kr." maxLength={40} />
              <TextInput label="Per" value={plan.period} onChange={(period) => update({ period })} placeholder="pr. måned" maxLength={40} />
            </div>
            <TextInput label="Short description" value={plan.description} onChange={(description) => update({ description })} maxLength={300} />
            <TextArea label="What's included" rows={4} value={plan.features} onChange={(features) => update({ features })} hint="One per line, starting with “- ”." maxLength={2000} />
            <TextInput label="Button text" value={plan.buttonLabel} onChange={(buttonLabel) => update({ buttonLabel })} hint="Leave empty for no button." maxLength={60} />
            {plan.buttonLabel && <ButtonTargetInput value={plan.button} onChange={(button) => update({ button })} steps={steps} stepIndex={stepIndex} />}
            <Toggle label="Highlight this one (“Most popular”)" checked={plan.highlighted} onChange={(highlighted) => update({ highlighted })} />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function TeamSettings({ block, onChange, onCredit }: Props<"team">) {
  const set = (patch: Partial<BlockOf<"team">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text under the heading" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <ListEditor
        items={block.people}
        onChange={(people) => set({ people })}
        itemLabel={(i) => `Person ${i + 1}`}
        newItem={() => ({ name: "", role: "", photoUrl: "", bio: "" })}
        max={16}
        addLabel="Add a person"
      >
        {(person, update) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Name" value={person.name} onChange={(name) => update({ name })} maxLength={120} />
              <TextInput label="Role" value={person.role} onChange={(role) => update({ role })} maxLength={120} />
            </div>
            <ImageInput label="Photo" value={person.photoUrl} onChange={(photoUrl) => update({ photoUrl })} onCredit={onCredit} hint="Square photos look best." />
            <TextArea label="A few words" rows={2} value={person.bio} onChange={(bio) => update({ bio })} hint="Optional" maxLength={600} />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function ContactSettings({ block, onChange, forms }: Props<"contact">) {
  const set = (patch: Partial<BlockOf<"contact">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} maxLength={200} />
      <TextArea label="Text" rows={2} value={block.text} onChange={(text) => set({ text })} hint="Optional" maxLength={1000} />
      <TextArea label="Address" rows={2} value={block.address} onChange={(address) => set({ address })} maxLength={300} />
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="Phone" value={block.phone} onChange={(phone) => set({ phone })} maxLength={40} />
        <TextInput label="Email" value={block.email} onChange={(email) => set({ email })} maxLength={200} />
      </div>
      <TextArea label="Opening hours" rows={3} value={block.openingHours} onChange={(openingHours) => set({ openingHours })} hint="One line per day or group of days." maxLength={600} />
      <Toggle label="Show a “Get directions” link" checked={block.showMap} onChange={(showMap) => set({ showMap })} hint="Opens the address in Google Maps." />
      <Select
        label="Form next to it"
        value={block.formId ?? ""}
        onChange={(formId) => set({ formId: formId || null })}
        options={[{ id: "", label: "No form" }, ...forms.map((f) => ({ id: f.id, label: f.is_active ? f.name : `${f.name} (switched off)` }))]}
      />
    </>
  );
}

export function GallerySettings({ block, onChange, onCredit }: Props<"gallery">) {
  const set = (patch: Partial<BlockOf<"gallery">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} hint="Optional" maxLength={200} />
      <Select
        label="Pictures per row on a computer"
        value={String(block.columns) as "2" | "3" | "4"}
        onChange={(columns) => set({ columns: Number(columns) as 2 | 3 | 4 })}
        options={[
          { id: "2", label: "2" },
          { id: "3", label: "3" },
          { id: "4", label: "4" },
        ]}
      />
      <ListEditor
        items={block.images}
        onChange={(images) => set({ images })}
        itemLabel={(i) => `Picture ${i + 1}`}
        newItem={() => ({ url: "", alt: "" })}
        max={24}
        addLabel="Add a picture"
      >
        {(image, update) => (
          <>
            <ImageInput label="Picture" value={image.url} onChange={(url) => update({ url })} onCredit={onCredit} />
            <TextInput label="Describe the picture" value={image.alt} onChange={(alt) => update({ alt })} maxLength={300} />
          </>
        )}
      </ListEditor>
    </>
  );
}

export function StatsSettings({ block, onChange }: Props<"stats">) {
  const set = (patch: Partial<BlockOf<"stats">>) => onChange({ ...block, ...patch });
  return (
    <>
      <TextInput label="Heading" value={block.heading} onChange={(heading) => set({ heading })} hint="Optional" maxLength={200} />
      <ListEditor
        items={block.items}
        onChange={(items) => set({ items })}
        itemLabel={(i) => `Figure ${i + 1}`}
        newItem={() => ({ value: "", label: "" })}
        max={6}
        addLabel="Add a figure"
      >
        {(item, update) => (
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <TextInput label="Number" value={item.value} onChange={(value) => update({ value })} placeholder="15+" maxLength={20} />
            <TextInput label="What it is" value={item.label} onChange={(label) => update({ label })} placeholder="års erfaring" maxLength={120} />
          </div>
        )}
      </ListEditor>
    </>
  );
}
