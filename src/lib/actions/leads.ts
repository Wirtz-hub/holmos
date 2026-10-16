"use server";

import { z } from "zod";
import { AiError, type AiProvider } from "@/lib/ai/ask";
import { requireAdmin } from "@/lib/auth";
import { checkWebsite } from "@/lib/leads/check";
import { writePitch } from "@/lib/leads/pitch";
import { LeadSearchError, searchBusinesses } from "@/lib/leads/search";
import { domainOf, scoreLead } from "@/lib/leads/signals";
import type { Lead, LeadPitch, WebsiteCheck } from "@/lib/leads/types";

type Fail = { ok: false; message: string };

const searchSchema = z.object({
  trade: z.string().trim().min(2, "Write what kind of business, e.g. dentist.").max(100),
  area: z.string().trim().min(2, "Write a town, region or country.").max(100),
  limit: z.number().int().min(5).max(60),
});

const normalName = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function searchLeadsAction(input: { trade: string; area: string; limit: number }): Promise<{ ok: true; leads: Lead[]; source: Lead["source"] } | Fail> {
  const { supabase } = await requireAdmin();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the search." };

  let found: Awaited<ReturnType<typeof searchBusinesses>>;
  try {
    found = await searchBusinesses(parsed.data.trade, parsed.data.area, parsed.data.limit);
  } catch (error) {
    return { ok: false, message: error instanceof LeadSearchError ? error.message : "Couldn't search right now. Try again." };
  }

  // Mark businesses that already have a card in the CRM, by website or name.
  const { data: clients } = await supabase.from("clients").select("id, name, website");
  const byDomain = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const client of clients ?? []) {
    const domain = domainOf(client.website);
    if (domain) byDomain.set(domain, client.id);
    byName.set(normalName(client.name), client.id);
  }
  const leads = found.leads.map((lead) => ({
    ...lead,
    clientId: (domainOf(lead.website) && byDomain.get(domainOf(lead.website)!)) || byName.get(normalName(lead.name)) || null,
  }));
  return { ok: true, leads, source: found.source };
}

export async function checkLeadWebsiteAction(website: string | null): Promise<WebsiteCheck> {
  await requireAdmin();
  return checkWebsite(typeof website === "string" ? website.slice(0, 500) : null);
}

// What the page sends back about a lead. Checked loosely: it only came from our own search.
const text = (max: number) => z.string().max(max).nullable();
const leadSchema = z.object({
  id: z.string().max(300),
  source: z.enum(["google", "osm"]),
  name: z.string().trim().min(1).max(200),
  category: text(200),
  address: text(500),
  phone: text(50),
  email: text(320),
  website: text(500),
  rating: z.number().min(0).max(5).nullable(),
  reviews: z.number().int().min(0).nullable(),
  mapsUrl: text(1000),
  clientId: z.uuid().nullable(),
});
const checkSchema = z
  .object({
    status: z.enum(["ok", "none", "down"]),
    url: text(1000),
    https: z.boolean(),
    mobileFriendly: z.boolean(),
    metaPixel: z.boolean(),
    googleTag: z.boolean(),
    googleAds: z.boolean(),
    builder: text(50),
    copyrightYear: z.number().int().nullable(),
    seconds: z.number().nullable(),
    emails: z.array(z.string().max(320)).max(5),
    phones: z.array(z.string().max(50)).max(3),
    socials: z.object({ facebook: text(1000), instagram: text(1000), linkedin: text(1000) }),
  })
  .nullable();
const pitchSchema = z
  .object({
    contactName: text(200),
    contactRole: text(200),
    contactEmail: text(320),
    summary: z.string().max(2000),
    angle: z.string().max(2000),
    subject: z.string().max(300),
    opener: z.string().max(5000),
  })
  .nullable();

export async function pitchLeadAction(input: { provider: AiProvider; lead: Lead; check: WebsiteCheck | null }): Promise<{ ok: true; pitch: LeadPitch } | Fail> {
  await requireAdmin();
  const provider = z.enum(["claude", "gemini"]).safeParse(input.provider);
  const lead = leadSchema.safeParse(input.lead);
  const check = checkSchema.safeParse(input.check);
  if (!provider.success || !lead.success || !check.success) return { ok: false, message: "Something about this lead looks wrong. Search again." };
  try {
    const pitch = await writePitch(provider.data, lead.data, check.data, scoreLead(lead.data, check.data));
    return { ok: true, pitch };
  } catch (error) {
    return { ok: false, message: error instanceof AiError ? error.message : "The AI couldn't write a message. Try again." };
  }
}

/** Puts a found business in the pipeline's New column, with what was found as notes. */
export async function addLeadToPipelineAction(input: { lead: Lead; check: WebsiteCheck | null; pitch: LeadPitch | null }): Promise<{ ok: true; clientId: string } | Fail> {
  const { supabase } = await requireAdmin();
  const parsedLead = leadSchema.safeParse(input.lead);
  const parsedCheck = checkSchema.safeParse(input.check);
  const parsedPitch = pitchSchema.safeParse(input.pitch);
  if (!parsedLead.success || !parsedCheck.success || !parsedPitch.success) return { ok: false, message: "Something about this lead looks wrong. Search again." };
  const lead = parsedLead.data;
  const check = parsedCheck.data;
  const pitch = parsedPitch.data;
  if (lead.clientId) return { ok: true, clientId: lead.clientId };

  const score = scoreLead(lead, check);
  const email = pitch?.contactEmail || lead.email || check?.emails[0] || null;
  const notes = [
    `Found with the lead finder (${lead.source === "google" ? "Google Maps" : "OpenStreetMap"}).`,
    lead.category && `Category: ${lead.category}`,
    lead.address && `Address: ${lead.address}`,
    lead.rating !== null && `Google: ${lead.rating} ★ from ${lead.reviews ?? 0} reviews`,
    lead.mapsUrl && `Map: ${lead.mapsUrl}`,
    "",
    `Lead score: ${score.score}/100`,
    ...score.reasons.map((reason) => `• ${reason}`),
    check?.socials.facebook && `Facebook: ${check.socials.facebook}`,
    check?.socials.instagram && `Instagram: ${check.socials.instagram}`,
    check?.socials.linkedin && `LinkedIn: ${check.socials.linkedin}`,
    pitch?.summary && `\n${pitch.summary}`,
    pitch?.angle && `Angle: ${pitch.angle}`,
  ]
    .filter((line) => line !== null && line !== false && line !== undefined)
    .join("\n");

  const { data: top } = await supabase.from("clients").select("stage_position").eq("stage", "new").order("stage_position", { ascending: true }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: lead.name,
      contact_name: pitch?.contactName ? [pitch.contactName, pitch.contactRole && `(${pitch.contactRole})`].filter(Boolean).join(" ") : null,
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
      phone: lead.phone || check?.phones[0] || null,
      website: check?.url || lead.website,
      stage: "new",
      stage_position: top ? Number(top.stage_position) - 1 : 0,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: `Couldn't save: ${error?.message ?? "unknown error"}` };

  if (pitch?.opener) {
    await supabase.from("activities").insert({ client_id: data.id, kind: "note", body: `Suggested first email\nSubject: ${pitch.subject}\n\n${pitch.opener}` });
  }
  return { ok: true, clientId: data.id };
}
