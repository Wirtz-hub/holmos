import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleAccountMetrics, listGoogleAdAccounts, parseGoogleMetrics, type GoogleConfig } from "@/lib/ads/google";
import { AdPlatformError } from "@/lib/ads/types";

const cfg: GoogleConfig = { clientId: "cid", clientSecret: "secret", developerToken: "dev-token", version: "v25" };

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (url: string, body: Record<string, string> | null) => unknown, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      const payload = handler(url, body);
      const code = (payload as { __status?: number })?.__status ?? status;
      return new Response(JSON.stringify(payload), { status: code });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("parseGoogleMetrics", () => {
  it("converts micros to money, merges conversion categories by day, and defaults missing numbers to 0", () => {
    const daily = parseGoogleMetrics(
      [
        { segments: { date: "2026-10-02" }, metrics: { costMicros: "12500000", impressions: "400", clicks: "12" } },
        { segments: { date: "2026-10-01" }, metrics: { costMicros: "1000000" } },
      ],
      [
        { segments: { date: "2026-10-02", conversionActionCategory: "SUBMIT_LEAD_FORM" }, metrics: { conversions: 2 } },
        { segments: { date: "2026-10-02", conversionActionCategory: "SUBMIT_LEAD_FORM" }, metrics: { conversions: 0.5 } },
      ],
    );
    expect(daily).toEqual([
      { date: "2026-10-01", spend: 1, impressions: 0, clicks: 0, conversions: {} },
      { date: "2026-10-02", spend: 12.5, impressions: 400, clicks: 12, conversions: { SUBMIT_LEAD_FORM: 2.5 } },
    ]);
  });
});

describe("fetchGoogleAccountMetrics", () => {
  it("sends the developer token and manager account, and follows pagination", async () => {
    const calls = mockFetch((_url, body) => {
      if (body?.query.includes("conversion_action_category")) {
        return { results: [{ segments: { date: "2026-10-01", conversionActionCategory: "PURCHASE" }, metrics: { conversions: 1 } }] };
      }
      if (!body?.pageToken) {
        return { results: [{ segments: { date: "2026-10-01" }, metrics: { costMicros: "2000000" } }], nextPageToken: "p2" };
      }
      return { results: [{ segments: { date: "2026-10-02" }, metrics: { costMicros: "3000000" } }] };
    });

    const metrics = await fetchGoogleAccountMetrics(cfg, "access", "1234567890", "9998887777", {
      from: "2026-10-01",
      to: "2026-10-02",
    });

    expect(metrics.daily.map((d) => [d.date, d.spend])).toEqual([
      ["2026-10-01", 2],
      ["2026-10-02", 3],
    ]);
    expect(metrics.daily[0].conversions).toEqual({ PURCHASE: 1 });
    expect(calls).toHaveLength(3);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(calls[0].url).toBe("https://googleads.googleapis.com/v25/customers/1234567890/googleAds:search");
    expect(headers["developer-token"]).toBe("dev-token");
    expect(headers["login-customer-id"]).toBe("9998887777");
    expect(headers.Authorization).toBe("Bearer access");
    expect(JSON.parse(calls[0].init.body as string).query).toContain("BETWEEN '2026-10-01' AND '2026-10-02'");
  });

  it("explains an unapproved developer token in plain language", async () => {
    mockFetch(() => ({
      __status: 403,
      error: {
        code: 403,
        message: "The caller does not have permission",
        details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" }, message: "..." }] }],
      },
    }));
    await expect(
      fetchGoogleAccountMetrics(cfg, "access", "1234567890", null, { from: "2026-10-01", to: "2026-10-01" }),
    ).rejects.toThrow(/only works with test accounts/);
  });
});

describe("listGoogleAdAccounts", () => {
  it("finds advertising accounts under manager accounts and skips managers and cancelled accounts", async () => {
    mockFetch((url) => {
      if (url.endsWith("customers:listAccessibleCustomers")) {
        return { resourceNames: ["customers/1110000000", "customers/2220000000"] };
      }
      if (url.includes("/customers/1110000000/")) {
        return {
          results: [
            { customerClient: { id: "1110000000", descriptiveName: "HolmNordic MCC", manager: true, status: "ENABLED", level: "0" } },
            { customerClient: { id: "3330000000", descriptiveName: "Clinic", currencyCode: "DKK", timeZone: "Europe/Copenhagen", status: "ENABLED", level: "1" } },
            { customerClient: { id: "4440000000", descriptiveName: "Old client", status: "CANCELED", level: "1" } },
          ],
        };
      }
      return { __status: 403, error: { message: "denied", details: [{ errors: [{ errorCode: { authorizationError: "CUSTOMER_NOT_ENABLED" } }] }] } };
    });

    const accounts = await listGoogleAdAccounts(cfg, "access");
    expect(accounts).toEqual([
      { externalId: "3330000000", name: "Clinic", currency: "DKK", timezone: "Europe/Copenhagen", loginCustomerId: "1110000000" },
    ]);
  });

  it("surfaces the error when nothing at all is reachable", async () => {
    mockFetch((url) =>
      url.endsWith("customers:listAccessibleCustomers")
        ? { resourceNames: ["customers/1"] }
        : { __status: 403, error: { details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" } }] }] } },
    );
    await expect(listGoogleAdAccounts(cfg, "access")).rejects.toBeInstanceOf(AdPlatformError);
  });
});
