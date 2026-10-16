// Runs every migration against an in-memory Postgres (PGlite) with a small
// stand-in for Supabase's auth schema, then checks triggers and row-level security.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");
const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

let db: PGlite;

async function as<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function asServer<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await db.exec("set role service_role");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

/** A website visitor: Supabase's "anon" role, with no login. */
async function asVisitor<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await db.exec("set role anon");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text,
      created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    insert into auth.users (id, email, created_at) values ('${ADMIN}', 'admin@example.com', now() - interval '1 day');
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`insert into auth.users (id, email) values ('${OTHER}', 'someone@example.com')`);
});

describe("access layer", () => {
  it("makes the first user admin and nobody else", async () => {
    const rows = (await db.query<{ user_id: string; role: string }>("select user_id, role from public.app_users")).rows;
    expect(Object.fromEntries(rows.map((r) => [r.user_id, r.role]))).toEqual({ [ADMIN]: "admin", [OTHER]: "client" });
  });

  it("gives non-admins nothing", async () => {
    const [client] = await as<{ id: string }>(ADMIN, "insert into public.clients (name) values ('Hidden Co') returning id");
    expect(await as(OTHER, "select * from public.clients")).toEqual([]);
    await expect(as(OTHER, "insert into public.clients (name) values ('Sneaky')")).rejects.toThrow(/row-level security/);
    await as(OTHER, `update public.app_users set role = 'admin' where user_id = '${OTHER}'`).catch(() => undefined);
    const [me] = (await db.query<{ role: string }>(`select role from public.app_users where user_id = '${OTHER}'`)).rows;
    expect(me.role).toBe("client");
    await as(ADMIN, "delete from public.clients where id = $1", [client.id]);
  });

  it("keeps ad platform tokens away from logged-in sessions", async () => {
    await asServer("insert into public.ad_connections (platform, external_user_id, label, access_token_enc) values ('meta', 'tok-test', 'X', 'v1.sealed')");
    await expect(as(ADMIN, "select access_token_enc from public.ad_connections")).rejects.toThrow(/permission denied/);
    await expect(as(ADMIN, "update public.ad_connections set access_token_enc = 'x'")).rejects.toThrow(/permission denied/);
    expect(await as(ADMIN, "select label, status from public.ad_connections where external_user_id = 'tok-test'")).toHaveLength(1);
  });

  it("scopes a future client login to their own client, read-only, once the portal is on", async () => {
    const [mine] = await as<{ id: string }>(ADMIN, "insert into public.clients (name) values ('Mine') returning id");
    await as(ADMIN, "insert into public.clients (name) values ('Not mine')");
    await as(ADMIN, "insert into public.client_access (user_id, client_id) values ($1, $2)", [OTHER, mine.id]);
    expect(await as(OTHER, "select name from public.clients")).toEqual([]);

    await as(ADMIN, "update public.clients set portal_enabled = true where id = $1", [mine.id]);
    expect(await as(OTHER, "select name from public.clients")).toEqual([{ name: "Mine" }]);
    expect(await as(OTHER, "update public.clients set name = 'Changed' returning id")).toEqual([]);
  });
});

describe("activity log triggers", () => {
  it("logs creation and stage moves, but not reordering within a stage", async () => {
    const [client] = await as<{ id: string }>(ADMIN, "insert into public.clients (name) values ('Logged') returning id");
    await as(ADMIN, "update public.clients set stage = 'proposal' where id = $1", [client.id]);
    await as(ADMIN, "update public.clients set stage_position = 9 where id = $1", [client.id]);
    const log = await as<{ kind: string; meta: Record<string, string> }>(
      ADMIN,
      "select kind, meta from public.activities where client_id = $1 order by created_at, kind",
      [client.id],
    );
    expect(log.map((a) => a.kind).sort()).toEqual(["created", "stage_changed"]);
    expect(log.find((a) => a.kind === "stage_changed")?.meta).toEqual({ from: "new", to: "proposal" });
  });

  it("logs ad account assignment, keeps it through re-syncs, and survives deleting the client", async () => {
    const [client] = await as<{ id: string }>(ADMIN, "insert into public.clients (name) values ('With ads') returning id");
    const [account] = await asServer<{ id: string }>(
      "insert into public.ad_accounts (platform, external_account_id, name) values ('google', '1234567890', 'Search') returning id",
    );
    await as(ADMIN, "update public.ad_accounts set client_id = $1 where id = $2", [client.id, account.id]);
    expect(await as(ADMIN, "select kind from public.activities where client_id = $1 and kind = 'ad_account_assigned'", [client.id])).toHaveLength(1);

    // What syncAdAccounts() does: upsert without touching client_id.
    await asServer(
      `insert into public.ad_accounts (platform, external_account_id, name, is_active) values ('google', '1234567890', 'Search (renamed)', true)
       on conflict (platform, external_account_id) do update set name = excluded.name, is_active = excluded.is_active`,
    );
    const [kept] = await as<{ client_id: string }>(ADMIN, "select client_id from public.ad_accounts where id = $1", [account.id]);
    expect(kept.client_id).toBe(client.id);

    await as(ADMIN, "delete from public.clients where id = $1", [client.id]);
    const [orphan] = await as<{ client_id: string | null }>(ADMIN, "select client_id from public.ad_accounts where id = $1", [account.id]);
    expect(orphan.client_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 2: funnels, forms, booking
// ---------------------------------------------------------------------------

/** A whole hour, `hours` from now, as an ISO string. */
function hoursFromNow(hours: number) {
  const date = new Date(Date.now() + hours * 3_600_000);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

async function newForm() {
  const [form] = await as<{ id: string }>(
    ADMIN,
    "insert into public.forms (name, notify_email, lead_stage) values ('Contact us', 'me@example.com', 'contacted') returning id",
  );
  return form.id;
}

async function submit(formId: string, contact: Record<string, string>, ipHash: string | null = null) {
  const answers = [
    { label: "Name", value: contact.name ?? "" },
    { label: "Message", value: "Hello" },
  ];
  const [row] = await asServer<{ result: { client_id: string; submission_id: string } }>(
    "select public.record_form_submission($1, $2, $3, $4, $5) as result",
    [formId, contact, answers, "https://example.com/offer", ipHash],
  );
  return row.result;
}

describe("what website visitors can see", () => {
  it("can't read any Phase 2 table directly", async () => {
    for (const table of ["forms", "form_submissions", "funnels", "booking_calendars", "bookings", "calendar_connections"]) {
      await expect(asVisitor(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("sees a funnel only once it's published, and only the published version", async () => {
    const [funnel] = await as<{ id: string }>(
      ADMIN,
      `insert into public.funnels (name, slug, draft) values ('Offer', 'spring-offer', '{"steps": [{"title": "Secret draft"}]}') returning id`,
    );
    const lookup = () => asVisitor<{ f: { content: unknown } | null }>("select public.published_funnel('spring-offer') as f");
    expect((await lookup())[0].f).toBeNull();

    await as(ADMIN, `update public.funnels set published = '{"steps": [{"title": "Live"}]}', published_at = now() where id = $1`, [funnel.id]);
    await as(ADMIN, `update public.funnels set draft = '{"steps": [{"title": "Next secret draft"}]}' where id = $1`, [funnel.id]);
    const [{ f }] = await lookup();
    expect(f?.content).toEqual({ steps: [{ title: "Live" }] });
    expect(JSON.stringify(f)).not.toMatch(/secret/i);

    await as(ADMIN, "update public.funnels set published = null where id = $1", [funnel.id]);
    expect((await lookup())[0].f).toBeNull();
  });

  it("finds a published funnel by its custom domain, with or without www", async () => {
    await as(
      ADMIN,
      `insert into public.funnels (name, slug, custom_domain, published) values ('Domain', 'on-domain', 'tilbud.example.dk', '{"steps": []}')`,
    );
    const find = async (host: string) =>
      (await asVisitor<{ f: { slug: string } | null }>("select public.published_funnel_for_domain($1) as f", [host]))[0].f?.slug ?? null;
    expect(await find("tilbud.example.dk")).toBe("on-domain");
    expect(await find("WWW.Tilbud.Example.dk")).toBe("on-domain");
    expect(await find("other.example.dk")).toBeNull();
    await expect(as(ADMIN, "update public.funnels set custom_domain = 'https://bad' where slug = 'on-domain'")).rejects.toThrow(/check/);
  });

  it("sees only active forms and booking pages, without internal settings", async () => {
    const formId = await newForm();
    const [{ f }] = await asVisitor<{ f: Record<string, unknown> }>("select public.public_form($1) as f", [formId]);
    expect(f).toMatchObject({ id: formId, submit_label: "Send" });
    expect(f).not.toHaveProperty("notify_email");
    expect(f).not.toHaveProperty("lead_stage");
    await as(ADMIN, "update public.forms set is_active = false where id = $1", [formId]);
    expect((await asVisitor("select public.public_form($1) as f", [formId]))[0]).toEqual({ f: null });

    const [cal] = await as<{ id: string }>(
      ADMIN,
      "insert into public.booking_calendars (name, slug, notify_email) values ('Intro call', 'intro-call', 'me@example.com') returning id",
    );
    const bySlug = (await asVisitor<{ c: Record<string, unknown> }>("select public.public_booking_calendar('intro-call') as c"))[0].c;
    const byId = (await asVisitor<{ c: Record<string, unknown> }>("select public.public_booking_calendar($1) as c", [cal.id]))[0].c;
    expect(bySlug).toEqual(byId);
    expect(bySlug).toMatchObject({ name: "Intro call", duration_minutes: 30 });
    for (const hidden of ["notify_email", "lead_stage", "availability"]) expect(bySlug).not.toHaveProperty(hidden);
    await as(ADMIN, "update public.booking_calendars set is_active = false where id = $1", [cal.id]);
    expect((await asVisitor("select public.public_booking_calendar('intro-call') as c"))[0]).toEqual({ c: null });
    await as(ADMIN, "delete from public.booking_calendars where id = $1", [cal.id]);
  });

  it("can only submit forms and book through the server", async () => {
    const formId = await newForm();
    const calls: [string, unknown[]][] = [
      ["select public.record_form_submission($1, '{}', '[]')", [formId]],
      [`select public.upsert_lead('{"email": "x@example.com"}')`, []],
      ["select public.book_slot(gen_random_uuid(), now(), '{}')", []],
      ["select public.cancel_booking_by_token('abc')", []],
    ];
    for (const [sql, params] of calls) {
      await expect(asVisitor(sql, params)).rejects.toThrow(/permission denied/);
      await expect(as(ADMIN, sql, params)).rejects.toThrow(/permission denied/);
    }
  });
});

describe("form submissions", () => {
  it("adds a new lead to the form's pipeline stage and logs the answers", async () => {
    const formId = await newForm();
    const { client_id } = await submit(formId, { name: "Ida Holm", email: "Ida@Example.com", phone: "+45 11 22 33 44" });
    const [client] = await as<Record<string, string>>(ADMIN, "select name, contact_name, email, stage from public.clients where id = $1", [client_id]);
    expect(client).toEqual({ name: "Ida Holm", contact_name: "Ida Holm", email: "ida@example.com", stage: "contacted" });

    const log = await as<{ kind: string; body: string | null; meta: Record<string, string> }>(
      ADMIN,
      "select kind, body, meta from public.activities where client_id = $1 order by kind",
      [client_id],
    );
    expect(log.map((a) => a.kind)).toEqual(["created", "form_submitted"]);
    const entry = log.find((a) => a.kind === "form_submitted")!;
    expect(entry.body).toBe("Name: Ida Holm\nMessage: Hello");
    expect(entry.meta).toMatchObject({ form: "Contact us", form_id: formId, page: "https://example.com/offer" });
  });

  it("updates the existing client instead of adding a duplicate", async () => {
    const formId = await newForm();
    const [existing] = await as<{ id: string }>(
      ADMIN,
      "insert into public.clients (name, email, stage) values ('Nordlys Tandklinik', 'kontakt@nordlys.dk', 'proposal') returning id",
    );
    const first = await submit(formId, { name: "Mette", email: " KONTAKT@nordlys.dk ", phone: "22 33 44 55", company: "Other name" });
    expect(first.client_id).toBe(existing.id);

    const [client] = await as<Record<string, string>>(
      ADMIN,
      "select name, contact_name, phone, stage from public.clients where id = $1",
      [existing.id],
    );
    // Blanks are filled in; the name and pipeline stage stay as they were.
    expect(client).toEqual({ name: "Nordlys Tandklinik", contact_name: "Mette", phone: "22 33 44 55", stage: "proposal" });

    // Phone numbers match with or without the country code.
    const second = await submit(formId, { name: "Mette", phone: "+45 2233 4455" });
    expect(second.client_id).toBe(existing.id);
    const [{ count }] = await as<{ count: number }>(
      ADMIN,
      "select count(*)::int as count from public.activities where client_id = $1 and kind = 'form_submitted'",
      [existing.id],
    );
    expect(count).toBe(2);
  });

  it("refuses closed forms and slows down repeated submissions", async () => {
    const formId = await newForm();
    for (let i = 0; i < 5; i++) await submit(formId, { email: `spam${i}@example.com` }, "ip-1");
    await expect(submit(formId, { email: "spam6@example.com" }, "ip-1")).rejects.toThrow(/rate_limited/);
    await submit(formId, { email: "real@example.com" }, "ip-2");

    await as(ADMIN, "update public.forms set is_active = false where id = $1", [formId]);
    await expect(submit(formId, { email: "late@example.com" })).rejects.toThrow(/form_closed/);
  });
});

describe("bookings", () => {
  let calendarId: string;

  beforeAll(async () => {
    const [cal] = await as<{ id: string }>(
      ADMIN,
      `insert into public.booking_calendars (name, slug, duration_minutes, buffer_before_minutes, buffer_after_minutes, lead_stage)
       values ('Strategy call', 'strategy-call', 45, 0, 15, 'qualified') returning id`,
    );
    calendarId = cal.id;
  });

  const book = async (startsAt: string, email: string, ipHash: string | null = null) =>
    (
      await asServer<{ b: { booking_id: string; client_id: string; cancel_token: string; ends_at: string } }>(
        "select public.book_slot($1, $2, $3, $4, $5) as b",
        [calendarId, startsAt, { name: "Booker", email, phone: "" }, "Looking forward", ipHash],
      )
    )[0].b;

  it("books a time, adds the lead and logs it", async () => {
    const start = hoursFromNow(48);
    const booking = await book(start, "booker@example.com");
    expect(new Date(booking.ends_at).getTime() - new Date(start).getTime()).toBe(45 * 60_000);
    expect(booking.cancel_token).toMatch(/^[0-9a-f]{64}$/);

    const [client] = await as<{ stage: string }>(ADMIN, "select stage from public.clients where id = $1", [booking.client_id]);
    expect(client.stage).toBe("qualified");
    const [entry] = await as<{ body: string; meta: Record<string, string> }>(
      ADMIN,
      "select body, meta from public.activities where client_id = $1 and kind = 'booking_created'",
      [booking.client_id],
    );
    expect(entry.body).toBe("Looking forward");
    expect(entry.meta).toMatchObject({ calendar: "Strategy call", booking_id: booking.booking_id, time_zone: "Europe/Copenhagen" });
  });

  it("never double-books a time, including the buffer after a meeting", async () => {
    const start = hoursFromNow(72);
    await book(start, "first@example.com");
    // 45-minute meeting + 15-minute buffer: anything starting within the hour clashes.
    const clash = new Date(new Date(start).getTime() + 50 * 60_000).toISOString();
    await expect(book(clash, "second@example.com")).rejects.toThrow(/slot_taken/);
    const free = new Date(new Date(start).getTime() + 60 * 60_000).toISOString();
    await book(free, "third@example.com");
  });

  it("lets the visitor cancel with their link, which frees the time", async () => {
    const start = hoursFromNow(96);
    const booking = await book(start, "canceller@example.com");
    const cancel = async () =>
      (await asServer<{ r: unknown }>("select public.cancel_booking_by_token($1) as r", [booking.cancel_token]))[0].r;

    expect(await cancel()).toEqual({ booking_id: booking.booking_id });
    expect(await cancel()).toBeNull();
    const [entry] = await as<{ meta: Record<string, string> }>(
      ADMIN,
      "select meta from public.activities where client_id = $1 and kind = 'booking_cancelled'",
      [booking.client_id],
    );
    expect(entry.meta.by).toBe("guest");

    const again = await book(start, "next@example.com");
    await as(ADMIN, "update public.bookings set status = 'cancelled', cancelled_at = now() where id = $1", [again.booking_id]);
    const [mine] = await as<{ meta: Record<string, string> }>(
      ADMIN,
      "select meta from public.activities where client_id = $1 and kind = 'booking_cancelled'",
      [again.client_id],
    );
    expect(mine.meta.by).toBe("you");
  });

  it("refuses times in the past and too many bookings from one visitor", async () => {
    await expect(book(new Date(Date.now() - 3_600_000).toISOString(), "late@example.com")).rejects.toThrow(/slot_in_past/);
    for (let i = 0; i < 3; i++) await book(hoursFromNow(200 + i * 2), `repeat${i}@example.com`, "ip-9");
    await expect(book(hoursFromNow(220), "repeat4@example.com", "ip-9")).rejects.toThrow(/rate_limited/);
  });

  it("keeps Google Calendar tokens away from logged-in sessions", async () => {
    await asServer(
      "insert into public.calendar_connections (external_user_id, email, refresh_token_enc) values ('g-1', 'me@example.com', 'v1.sealed')",
    );
    await expect(as(ADMIN, "select refresh_token_enc from public.calendar_connections")).rejects.toThrow(/permission denied/);
    await expect(as(ADMIN, "update public.calendar_connections set refresh_token_enc = 'x'")).rejects.toThrow(/permission denied/);
    await as(ADMIN, "update public.calendar_connections set busy_calendar_ids = array['primary', 'team@example.com']");
    expect(await as(ADMIN, "select email, busy_calendar_ids from public.calendar_connections")).toEqual([
      { email: "me@example.com", busy_calendar_ids: ["primary", "team@example.com"] },
    ]);
    expect(await as(OTHER, "select email from public.calendar_connections")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pages and forms for clients, with a contact list per client
// ---------------------------------------------------------------------------

describe("client contact lists", () => {
  async function clientWithForm(name: string) {
    const [client] = await as<{ id: string }>(ADMIN, "insert into public.clients (name) values ($1) returning id", [name]);
    const [form] = await as<{ id: string }>(
      ADMIN,
      "insert into public.forms (name, client_id) values ($1, $2) returning id",
      [`${name} contact form`, client.id],
    );
    return { clientId: client.id, formId: form.id };
  }

  const countClients = async () => (await as<{ n: number }>(ADMIN, "select count(*)::int as n from public.clients"))[0].n;

  it("puts answers to a client's form on that client's list, not in your pipeline", async () => {
    const { clientId, formId } = await clientWithForm("Tandlæge Holm");
    const before = await countClients();

    const result = (await submit(formId, { name: "Patient Pia", email: "Pia@Example.com" })) as unknown as {
      client_id: string | null;
      contact_id: string;
      owner_client_id: string;
    };
    expect(result.client_id).toBeNull();
    expect(result.owner_client_id).toBe(clientId);
    expect(await countClients()).toBe(before);

    const [contact] = await as<Record<string, unknown>>(ADMIN, "select client_id, name, email from public.contacts where id = $1", [
      result.contact_id,
    ]);
    expect(contact).toEqual({ client_id: clientId, name: "Patient Pia", email: "pia@example.com" });
    const events = await as<{ kind: string; body: string | null }>(
      ADMIN,
      "select kind, body from public.contact_events where contact_id = $1 order by kind",
      [result.contact_id],
    );
    expect(events.map((e) => e.kind)).toEqual(["created", "form_submitted"]);
    expect(events[1].body).toContain("Message: Hello");
  });

  it("recognises returning people per client, but keeps each client's list separate", async () => {
    const a = await clientWithForm("Frisør A");
    const b = await clientWithForm("Frisør B");
    const first = (await submit(a.formId, { email: "kunde@example.com" })) as unknown as { contact_id: string };
    const again = (await submit(a.formId, { email: "KUNDE@example.com", phone: "11 22 33 44", name: "Kim" })) as unknown as {
      contact_id: string;
    };
    const other = (await submit(b.formId, { email: "kunde@example.com" })) as unknown as { contact_id: string };

    expect(again.contact_id).toBe(first.contact_id);
    expect(other.contact_id).not.toBe(first.contact_id);
    const [filled] = await as<Record<string, string>>(ADMIN, "select name, phone from public.contacts where id = $1", [first.contact_id]);
    expect(filled).toEqual({ name: "Kim", phone: "11 22 33 44" });
  });

  it("keeps contact lists private, and lets a future client login read only its own", async () => {
    const { clientId, formId } = await clientWithForm("Privat Klinik");
    await submit(formId, { email: "hemmelig@example.com" });
    await expect(asVisitor("select * from public.contacts")).rejects.toThrow(/permission denied/);
    expect(await as(OTHER, "select email from public.contacts")).toEqual([]);
    await expect(as(ADMIN, "select public.upsert_contact($1, '{\"email\": \"x@example.com\"}')", [clientId])).rejects.toThrow(
      /permission denied/,
    );

    await as(ADMIN, "insert into public.client_access (user_id, client_id) values ($1, $2)", [OTHER, clientId]);
    await as(ADMIN, "update public.clients set portal_enabled = true where id = $1", [clientId]);
    expect(await as(OTHER, "select email from public.contacts")).toEqual([{ email: "hemmelig@example.com" }]);
    expect(await as(OTHER, "select kind from public.contact_events order by kind")).toEqual([{ kind: "created" }, { kind: "form_submitted" }]);
    expect(await as(OTHER, "update public.contacts set notes = 'x' returning id")).toEqual([]);
  });

  it("removes a client's contacts with the client, and its forms fall back to your pipeline", async () => {
    const { clientId, formId } = await clientWithForm("Lukket Firma");
    await submit(formId, { email: "gammel@example.com" });
    await as(ADMIN, "delete from public.clients where id = $1", [clientId]);

    expect(await as(ADMIN, "select id from public.contacts where client_id = $1", [clientId])).toEqual([]);
    const [form] = await as<{ client_id: string | null }>(ADMIN, "select client_id from public.forms where id = $1", [formId]);
    expect(form.client_id).toBeNull();
    const after = (await submit(formId, { email: "ny@example.com" })) as unknown as { client_id: string | null };
    expect(after.client_id).not.toBeNull();
  });
});
