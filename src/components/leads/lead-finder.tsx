"use client";

import { Check, Copy, Download, ExternalLink, Globe, LoaderCircle, Mail, MapPin, Phone, Plus, Radar, Search, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, buttonClass, Card, cx, EmptyState, Field, inputClass, Notice } from "@/components/ui";
import { addLeadToPipelineAction, checkLeadWebsiteAction, pitchLeadAction, searchLeadsAction } from "@/lib/actions/leads";
import type { AiProvider } from "@/lib/ai/ask";
import { scoreLead } from "@/lib/leads/signals";
import type { Lead, LeadPitch, WebsiteCheck } from "@/lib/leads/types";

type Row = {
  lead: Lead;
  check: WebsiteCheck | null;
  checking: boolean;
  pitch: LeadPitch | null;
  pitching: boolean;
  error: string | null;
  adding: boolean;
};

type Saved = { trade: string; area: string; source: Lead["source"]; rows: Row[] };

const STORAGE_KEY = "holmos.leadFinder";
const CHECKS_AT_ONCE = 4;

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(value: Saved) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Results just won't survive a page change.
  }
}

function scoreStyle(score: number) {
  if (score >= 50) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 25) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function LeadFinder({ googleMaps, ai }: { googleMaps: boolean; ai: Record<AiProvider, boolean> }) {
  const [trade, setTrade] = useState("");
  const [area, setArea] = useState("");
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<Lead["source"] | null>(null);
  const [searched, setSearched] = useState<{ trade: string; area: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideKnown, setHideKnown] = useState(true);
  const [onlyNoSite, setOnlyNoSite] = useState(false);
  const [provider, setProvider] = useState<AiProvider>(ai.claude ? "claude" : "gemini");
  const [searching, startSearch] = useTransition();
  const runId = useRef(0);

  // Bring back the last search after visiting another page.
  useEffect(() => {
    const saved = load();
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's storage after the first render
    setRows(saved.rows.map((row) => ({ ...row, checking: false, pitching: false, adding: false })));
    setSource(saved.source);
    setSearched({ trade: saved.trade, area: saved.area });
    setTrade(saved.trade);
    setArea(saved.area);
  }, []);

  useEffect(() => {
    if (searched && source) save({ ...searched, source, rows });
  }, [rows, searched, source]);

  const update = (id: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.lead.id === id ? { ...row, ...change } : row)));

  async function checkAll(leads: Lead[], run: number) {
    const queue = [...leads];
    const worker = async () => {
      for (let lead = queue.shift(); lead; lead = queue.shift()) {
        if (runId.current !== run) return;
        try {
          const check = await checkLeadWebsiteAction(lead.website);
          if (runId.current === run) update(lead.id, { check, checking: false });
        } catch {
          if (runId.current === run) update(lead.id, { checking: false });
        }
      }
    };
    await Promise.all(Array.from({ length: CHECKS_AT_ONCE }, worker));
  }

  function search() {
    startSearch(async () => {
      const result = await searchLeadsAction({ trade, area, limit });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      const run = ++runId.current;
      setSource(result.source);
      setSearched({ trade: trade.trim(), area: area.trim() });
      setRows(result.leads.map((lead) => ({ lead, check: null, checking: true, pitch: null, pitching: false, error: null, adding: false })));
      void checkAll(result.leads, run);
    });
  }

  async function writePitch(row: Row) {
    update(row.lead.id, { pitching: true, error: null });
    const result = await pitchLeadAction({ provider, lead: row.lead, check: row.check });
    update(row.lead.id, result.ok ? { pitching: false, pitch: result.pitch } : { pitching: false, error: result.message });
  }

  async function addToPipeline(row: Row) {
    update(row.lead.id, { adding: true, error: null });
    const result = await addLeadToPipelineAction({ lead: row.lead, check: row.check, pitch: row.pitch });
    update(row.lead.id, result.ok ? { adding: false, lead: { ...row.lead, clientId: result.clientId } } : { adding: false, error: result.message });
  }

  const scored = useMemo(
    () =>
      rows
        .map((row) => ({ ...row, score: scoreLead(row.lead, row.check) }))
        .filter((row) => !(hideKnown && row.lead.clientId) && !(onlyNoSite && row.check?.status !== "none" && row.check?.status !== "down"))
        .sort((a, b) => b.score.score - a.score.score),
    [rows, hideKnown, onlyNoSite],
  );
  const stillChecking = rows.filter((row) => row.checking).length;
  const known = rows.filter((row) => row.lead.clientId).length;
  const anyAi = ai.claude || ai.gemini;

  function downloadCsv() {
    const header = ["Name", "Score", "Reasons", "Category", "Address", "Phone", "Email", "Contact", "Website", "Google rating", "Reviews", "Facebook", "Instagram", "Map"];
    const lines = scored.map((row) =>
      [
        row.lead.name,
        row.score.score,
        row.score.reasons.join("; "),
        row.lead.category,
        row.lead.address,
        row.lead.phone ?? row.check?.phones[0],
        row.pitch?.contactEmail ?? row.lead.email ?? row.check?.emails[0],
        row.pitch?.contactName,
        row.check?.url ?? row.lead.website,
        row.lead.rating,
        row.lead.reviews,
        row.check?.socials.facebook,
        row.check?.socials.instagram,
        row.lead.mapsUrl,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([`﻿${[header.join(","), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-${searched?.trade ?? "search"}-${searched?.area ?? ""}.csv`.replace(/[^\w.-]+/g, "-");
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form
          className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Field label="What kind of business?" htmlFor="lf-trade">
            <input id="lf-trade" value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. tandlæge, frisør, plumber" className={inputClass} required />
          </Field>
          <Field label="Where?" htmlFor="lf-area">
            <input id="lf-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Aarhus, Malmö, Oslo, Berlin" className={inputClass} required />
          </Field>
          <Field label="How many?" htmlFor="lf-limit">
            <select id="lf-limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={inputClass}>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
            </select>
          </Field>
          <Button type="submit" disabled={searching}>
            {searching ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Find leads
          </Button>
        </form>
        {!googleMaps && (
          <p className="mt-4 text-xs text-slate-500">
            Searching OpenStreetMap (free, but it knows fewer businesses and has no reviews). Add a Google Maps key for far better results — SETUP.md, step 8.
          </p>
        )}
      </Card>

      {error && <Notice kind="error">{error}</Notice>}

      {searched && rows.length === 0 && !searching && !error && (
        <Card>
          <EmptyState icon={<Radar className="size-5" />} title="No businesses found">
            Try another word for the trade (in English or the local language), or a bigger area.
          </EmptyState>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {rows.length} found{known ? ` · ${known} already in your CRM` : ""}
              {stillChecking > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-500">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> checking websites ({rows.length - stillChecking}/{rows.length})
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} className="rounded border-slate-300" />
                Hide ones in my CRM
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={onlyNoSite} onChange={(e) => setOnlyNoSite(e.target.checked)} className="rounded border-slate-300" />
                Only without a working website
              </label>
              {ai.claude && ai.gemini && (
                <label className="inline-flex items-center gap-2">
                  AI:
                  <select value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)} className="rounded-md border-slate-300 py-1 text-sm">
                    <option value="claude">Claude</option>
                    <option value="gemini">Gemini (free)</option>
                  </select>
                </label>
              )}
              <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={!scored.length}>
                <Download className="size-4" aria-hidden /> CSV
              </Button>
            </div>
          </div>

          <Card className="divide-y divide-slate-100">
            {scored.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing matches the filters.</p>}
            {scored.map((row) => (
              <LeadRow key={row.lead.id} row={row} score={row.score} anyAi={anyAi} onPitch={() => writePitch(row)} onAdd={() => addToPipeline(row)} />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function LeadRow({
  row,
  score,
  anyAi,
  onPitch,
  onAdd,
}: {
  row: Row;
  score: ReturnType<typeof scoreLead>;
  anyAi: boolean;
  onPitch: () => void;
  onAdd: () => void;
}) {
  const { lead, check, pitch } = row;
  const email = pitch?.contactEmail ?? lead.email ?? check?.emails[0] ?? null;
  const phone = lead.phone ?? check?.phones[0] ?? null;
  const website = check?.url ?? lead.website;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{lead.name}</h3>
            {row.checking ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200 ring-inset">
                <LoaderCircle className="size-3 animate-spin" aria-hidden /> checking
              </span>
            ) : (
              <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset", scoreStyle(score.score))} title="How much they look like they need an agency">
                {score.score}/100
              </span>
            )}
            {lead.category && <span className="text-xs text-slate-500">{lead.category}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {lead.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {lead.address}
              </span>
            )}
            {lead.rating !== null && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5" aria-hidden /> {lead.rating.toFixed(1)} ({lead.reviews ?? 0})
              </span>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                <Phone className="size-3.5" aria-hidden /> {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                <Mail className="size-3.5" aria-hidden /> {email}
              </a>
            )}
            {website && (
              <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-700">
                <Globe className="size-3.5" aria-hidden /> {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            )}
            {lead.mapsUrl && (
              <a href={lead.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-700">
                <ExternalLink className="size-3.5" aria-hidden /> Map
              </a>
            )}
          </div>
          {!row.checking && score.reasons.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {score.reasons.map((reason) => (
                <li key={reason} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {anyAi && !pitch && (
            <Button variant="secondary" size="sm" onClick={onPitch} disabled={row.pitching || row.checking} title="The AI reads their website, finds who to contact and writes a first email">
              {row.pitching ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              Contact & email
            </Button>
          )}
          {lead.clientId ? (
            <Link href={`/clients/${lead.clientId}`} className={buttonClass("ghost", "sm")}>
              <Check className="size-4 text-emerald-600" aria-hidden /> In pipeline
            </Link>
          ) : (
            <Button size="sm" onClick={onAdd} disabled={row.adding || row.checking || row.pitching}>
              {row.adding ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              Add to pipeline
            </Button>
          )}
        </div>
      </div>
      {row.error && <p className="mt-2 text-sm text-rose-600">{row.error}</p>}
      {pitch && <PitchBox pitch={pitch} />}
    </div>
  );
}

function PitchBox({ pitch }: { pitch: LeadPitch }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${pitch.subject}\n\n${pitch.opener}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying isn't allowed here; the text can still be selected by hand.
    }
  };
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200 ring-inset">
      <p className="text-slate-700">
        <span className="font-medium text-slate-900">Who to contact: </span>
        {pitch.contactName ? `${pitch.contactName}${pitch.contactRole ? ` (${pitch.contactRole})` : ""}` : "The website doesn't name anyone — use the general email or call."}
      </p>
      {pitch.angle && (
        <p className="mt-1 text-slate-700">
          <span className="font-medium text-slate-900">Angle: </span>
          {pitch.angle}
        </p>
      )}
      <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-slate-900">{pitch.subject}</p>
          <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600">
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 whitespace-pre-line text-slate-700">{pitch.opener}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">Read it through before sending. It&apos;s saved on the client card when you add them to the pipeline.</p>
    </div>
  );
}
