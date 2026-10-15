import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMetaAccountMetrics, listMetaAdAccounts, metaAuthUrl, parseMetaInsights, type MetaConfig } from "@/lib/ads/meta";

const cfg: MetaConfig = { appId: "app", appSecret: "app-secret", version: "v26.0" };

function mockFetch(handler: (url: URL) => { status?: number; body: unknown }) {
  const calls: { url: URL; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init: RequestInit = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      const { status = 200, body } = handler(url);
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("metaAuthUrl", () => {
  it("asks for read-only ad access, or uses a Login for Business configuration when set", () => {
    const classic = new URL(metaAuthUrl(cfg, "https://app/cb", "state123"));
    expect(classic.searchParams.get("scope")).toBe("ads_read,business_management");
    expect(classic.searchParams.get("state")).toBe("state123");
    const business = new URL(metaAuthUrl({ ...cfg, loginConfigId: "cfg9" }, "https://app/cb", "s"));
    expect(business.searchParams.get("config_id")).toBe("cfg9");
    expect(business.searchParams.has("scope")).toBe(false);
  });
});

describe("parseMetaInsights", () => {
  it("prefers link clicks and turns action strings into numbers", () => {
    expect(
      parseMetaInsights([
        {
          date_start: "2026-10-01",
          spend: "123.45",
          impressions: "1000",
          clicks: "80",
          inline_link_clicks: "30",
          actions: [{ action_type: "lead", value: "4" }],
        },
      ]),
    ).toEqual([{ date: "2026-10-01", spend: 123.45, impressions: 1000, clicks: 30, conversions: { lead: 4 } }]);
  });
});

describe("fetchMetaAccountMetrics", () => {
  it("fetches daily rows (following pages) plus range reach, signed with appsecret_proof", async () => {
    const calls = mockFetch((url) => {
      if (url.searchParams.get("fields") === "reach") return { body: { data: [{ date_start: "2026-10-01", reach: "777" }] } };
      if (url.searchParams.get("after") === "c2") {
        return { body: { data: [{ date_start: "2026-10-02", spend: "5" }] } };
      }
      const next = new URL(url);
      next.searchParams.set("after", "c2");
      next.searchParams.set("access_token", "leaked-into-url");
      return { body: { data: [{ date_start: "2026-10-01", spend: "10" }], paging: { next: next.toString() } } };
    });

    const metrics = await fetchMetaAccountMetrics(cfg, "user-token", "123", { from: "2026-10-01", to: "2026-10-02" });
    expect(metrics.reach).toBe(777);
    expect(metrics.daily.map((d) => d.spend)).toEqual([10, 5]);

    const first = calls[0];
    expect(first.url.pathname).toBe("/v26.0/act_123/insights");
    expect(first.url.searchParams.get("time_range")).toBe('{"since":"2026-10-01","until":"2026-10-02"}');
    expect(first.url.searchParams.get("appsecret_proof")).toBe(
      createHmac("sha256", "app-secret").update("user-token").digest("hex"),
    );
    expect((first.init.headers as Record<string, string>).Authorization).toBe("Bearer user-token");
    // Tokens travel in the header only, never in a URL.
    expect(calls.every((call) => !call.url.searchParams.has("access_token"))).toBe(true);
  });

  it("flags an expired login so the app can ask for a reconnect", async () => {
    mockFetch(() => ({ status: 400, body: { error: { message: "Session has expired", code: 190 } } }));
    await expect(
      fetchMetaAccountMetrics(cfg, "old", "123", { from: "2026-10-01", to: "2026-10-01" }),
    ).rejects.toMatchObject({ needsReconnect: true });
  });
});

describe("listMetaAdAccounts", () => {
  it("combines personal and Business Manager accounts, de-duplicated, skipping closed ones", async () => {
    mockFetch((url) => {
      const path = url.pathname;
      if (path.endsWith("/me/adaccounts")) {
        return { body: { data: [{ account_id: "1", name: "Clinic", currency: "DKK", timezone_name: "Europe/Copenhagen", account_status: 1 }] } };
      }
      if (path.endsWith("/me/businesses")) return { body: { data: [{ id: "biz" }] } };
      if (path.endsWith("/biz/owned_ad_accounts")) {
        return { body: { data: [{ account_id: "1", name: "Clinic" }, { account_id: "2", name: "Gym", currency: "EUR" }] } };
      }
      if (path.endsWith("/biz/client_ad_accounts")) {
        return { body: { data: [{ account_id: "3", name: "Closed one", account_status: 101 }] } };
      }
      return { status: 404, body: { error: { message: "unknown" } } };
    });

    const accounts = await listMetaAdAccounts(cfg, "token");
    expect(accounts.map((a) => [a.externalId, a.name, a.currency])).toEqual([
      ["1", "Clinic", "DKK"],
      ["2", "Gym", "EUR"],
    ]);
  });
});
