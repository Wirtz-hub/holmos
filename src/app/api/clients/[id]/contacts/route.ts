import { requireAdmin } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { slugify } from "@/lib/funnels/schema";

// A client's contact list as a spreadsheet file that opens straight in Danish Excel
// (semicolons between columns, and a marker so Æ, Ø and Å show correctly).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cell(value: string | null | undefined) {
  const text = (value ?? "").replace(/\r?\n/g, " ");
  // Quote everything; a leading = + - @ is neutralised so Excel never runs it as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const { supabase } = await requireAdmin();

  const [{ data: client }, { data: contacts, error }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("name, email, phone, company, website, tags, created_at").eq("client_id", id).order("created_at"),
  ]);
  if (!client) return new Response("Not found", { status: 404 });
  if (error) return new Response("Couldn't load the contacts", { status: 500 });

  const header = ["Navn", "E-mail", "Telefon", "Firma", "Hjemmeside", "Tags", "Tilføjet"];
  const rows = (contacts ?? []).map((c) =>
    [c.name, c.email, c.phone, c.company, c.website, (c.tags ?? []).join(", "), todayIn(undefined, new Date(c.created_at))].map(cell).join(";"),
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(client.name) || "kunde"}-kontakter.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
