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
