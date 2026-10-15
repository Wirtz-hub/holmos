import { z } from "zod";
import { newId, type Language } from "@/lib/funnels/schema";
import { publicText } from "@/lib/public-text";

// Form fields, and checking a visitor's answers against them.

export const FIELD_TYPES = [
  { id: "text", label: "Short text" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "textarea", label: "Long text" },
  { id: "select", label: "Dropdown" },
  { id: "checkbox", label: "Tick box" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["id"];

/** Which client detail an answer fills in. Email and phone fields always do. */
export const MAPS_TO = [
  { id: "", label: "Nothing — just log the answer" },
  { id: "name", label: "Contact name" },
  { id: "company", label: "Business name" },
  { id: "website", label: "Website" },
] as const;
export type MapsTo = (typeof MAPS_TO)[number]["id"];

export const fieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{4,40}$/i),
  type: z.enum(FIELD_TYPES.map((t) => t.id) as [FieldType, ...FieldType[]]),
  label: z.string().trim().min(1, "Every field needs a label").max(200),
  placeholder: z.string().max(200).default(""),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  mapsTo: z.enum(["", "name", "company", "website"]).default(""),
});
export type FormField = z.infer<typeof fieldSchema>;

export const fieldsSchema = z
  .array(fieldSchema)
  .min(1, "Add at least one field")
  .max(30, "A form can have up to 30 fields")
  .refine((fields) => fields.some((f) => f.type === "email" || f.type === "phone"), {
    message: "Add an Email or Phone field, so answers can be matched to a client.",
  })
  .refine((fields) => fields.every((f) => f.type !== "select" || f.options.length > 0), {
    message: "Give every dropdown at least one choice.",
  });

export function newField(type: FieldType, language: Language = "da"): FormField {
  const da = language === "da";
  const labels: Record<FieldType, string> = {
    text: da ? "Spørgsmål" : "Question",
    email: da ? "E-mail" : "Email",
    phone: da ? "Telefon" : "Phone",
    textarea: da ? "Besked" : "Message",
    select: da ? "Vælg en mulighed" : "Choose one",
    checkbox: da ? "Ja, I må kontakte mig" : "Yes, you may contact me",
  };
  return {
    id: newId(),
    type,
    label: labels[type],
    placeholder: "",
    required: type === "email",
    options: type === "select" ? (da ? ["Mulighed 1", "Mulighed 2"] : ["Option 1", "Option 2"]) : [],
    mapsTo: "",
  };
}

export function defaultFields(language: Language = "da"): FormField[] {
  return [
    { ...newField("text", language), label: language === "da" ? "Navn" : "Name", required: true, mapsTo: "name" },
    newField("email", language),
    newField("phone", language),
    newField("textarea", language),
  ];
}

export type PublicFormDef = {
  id: string;
  fields: FormField[];
  submit_label: string;
  success_message: string;
  redirect_url: string | null;
  language: Language;
};

export type Contact = { name?: string; email?: string; phone?: string; company?: string; website?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{6,25}$/;
const MAX_LENGTH: Record<FieldType, number> = { text: 500, email: 320, phone: 40, textarea: 5000, select: 200, checkbox: 10 };

/**
 * Checks a visitor's answers (field id → value) against the form's fields.
 * Returns per-field error messages in the form's language, or the cleaned
 * answers, the snapshot to store, and the contact details for the client record.
 */
export function checkAnswers(fields: FormField[], raw: Record<string, unknown>, language: Language) {
  const text = publicText(language);
  const errors: Record<string, string> = {};
  const answers: { label: string; value: string }[] = [];
  const contact: Contact = {};

  for (const field of fields) {
    const input = raw[field.id];
    let value = typeof input === "string" ? input.trim() : typeof input === "boolean" ? (input ? "yes" : "") : "";
    if (field.type === "checkbox") value = value && value !== "false" ? text.yes : "";

    if (!value) {
      if (field.required) errors[field.id] = field.type === "checkbox" ? text.mustTick : text.required;
      continue;
    }
    if (value.length > MAX_LENGTH[field.type]) {
      errors[field.id] = text.tooLong;
      continue;
    }
    if (field.type === "email" && !EMAIL.test(value)) {
      errors[field.id] = text.badEmail;
      continue;
    }
    if (field.type === "phone" && (!PHONE.test(value) || value.replace(/\D/g, "").length < 6)) {
      errors[field.id] = text.badPhone;
      continue;
    }
    if (field.type === "select" && !field.options.includes(value)) {
      errors[field.id] = text.required;
      continue;
    }

    answers.push({ label: field.label, value });
    if (field.type === "email") contact.email ??= value.toLowerCase();
    else if (field.type === "phone") contact.phone ??= value;
    else if (field.mapsTo) contact[field.mapsTo] ??= value;
  }

  if (Object.keys(errors).length) return { ok: false as const, errors };
  return { ok: true as const, answers, contact };
}
