import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickContact } from "@/lib/instagram/contacts";
import {
  instagramAuthUrl,
  listInstagramConversations,
  listLinkedInstagramAccounts,
  sendInstagramText,
  type InstagramConfig,
} from "@/lib/instagram/graph";
import { draftTextError, otherParticipant, snippetFor } from "@/lib/instagram/messages";
import { secretMatches, verifyMetaSignature } from "@/lib/instagram/signature";
import { parseInstagramWebhook } from "@/lib/instagram/webhook-parse";
import { messagingWindow, outsideWindowMessage } from "@/lib/instagram/window";

const cfg: InstagramConfig = { appId: "app", appSecret: "app-secret", version: "v26.0" };

function mockFetch(handler: (url: URL, init?: RequestInit) => { status?: number; body: unknown }) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({ url, init });
      const { status = 200, body } = handler(url, init);
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("instagramAuthUrl", () => {
  it("asks for messaging permissions and never the ads login configuration", () => {
    const url = new URL(instagramAuthUrl(cfg, "https://app.example/api/oauth/instagram/callback", "state123"));
    expect(url.searchParams.get("scope")).toContain("instagram_manage_messages");
    expect(url.searchParams.get("scope")).toContain("pages_manage_metadata");
    expect(url.searchParams.get("scope")).not.toContain("ads_read");
    expect(url.searchParams.has("config_id")).toBe(false);
    expect(url.searchParams.get("state")).toBe("state123");
  });

  it("uses a separate messaging configuration when one is set", () => {
    const url = new URL(instagramAuthUrl({ ...cfg, loginConfigId: "ig-cfg" }, "https://app.example/cb", "s"));
    expect(url.searchParams.get("config_id")).toBe("ig-cfg");
    expect(url.searchParams.has("scope")).toBe(false);
  });
});

describe("webhook signature", () => {
  it("accepts Meta's signature and rejects a tampered body", () => {
    const raw = JSON.stringify({ object: "instagram" });
    const header = `sha256=${createHmac("sha256", "app-secret").update(raw).digest("hex")}`;
    expect(verifyMetaSignature(raw, header, "app-secret")).toBe(true);
    expect(verifyMetaSignature(`${raw} `, header, "app-secret")).toBe(false);
    expect(verifyMetaSignature(raw, header, "other-secret")).toBe(false);
    expect(verifyMetaSignature(raw, null, "app-secret")).toBe(false);
  });

  it("compares secrets without accepting a missing one", () => {
    expect(secretMatches("token", "token")).toBe(true);
    expect(secretMatches("token", "nope")).toBe(false);
    expect(secretMatches("", "token")).toBe(false);
    expect(secretMatches("token", "")).toBe(false);
  });
});

describe("parseInstagramWebhook", () => {
  it("reads an incoming message, an echo, a deletion and a read receipt", () => {
    const parsed = parseInstagramWebhook({
      object: "instagram",
      entry: [
        {
          id: "IG",
          messaging: [
            {
              sender: { id: "CUSTOMER" },
              recipient: { id: "IG" },
              timestamp: 1_700_000_000_000,
              message: {
                mid: "m-in",
                text: "Hello",
                attachments: [{ type: "image", payload: { url: "https://cdn.example/a.jpg" } }],
              },
            },
            {
              sender: { id: "IG" },
              recipient: { id: "CUSTOMER" },
              timestamp: 1_700_000_000_500,
              message: { mid: "m-out", text: "Reply", is_echo: true },
            },
            {
              sender: { id: "CUSTOMER" },
              recipient: { id: "IG" },
              timestamp: 1_700_000_000_800,
              message: { mid: "m-in", is_deleted: true },
            },
            {
              sender: { id: "CUSTOMER" },
              recipient: { id: "IG" },
              timestamp: 1_700_000_000_900,
              read: { mid: "m-out" },
            },
          ],
        },
      ],
    });

    expect(parsed.messages.map((message) => [message.externalId, message.direction, message.text, message.attachments])).toEqual([
      ["m-in", "inbound", "Hello", [{ type: "image", url: "https://cdn.example/a.jpg" }]],
      ["m-out", "outbound", "Reply", []],
      ["m-in", "inbound", null, [{ type: "deleted", url: null }]],
    ]);
    expect(parsed.messages[0].participantId).toBe("CUSTOMER");
    expect(parsed.messages[1].participantId).toBe("CUSTOMER");
    expect(parsed.reads).toEqual([
      { igUserId: "IG", participantId: "CUSTOMER", messageId: "m-out", at: new Date(1_700_000_000_900).toISOString() },
    ]);
  });

  it("ignores reactions and other objects", () => {
    expect(parseInstagramWebhook({ object: "page", entry: [] })).toEqual({ messages: [], reads: [] });
    expect(
      parseInstagramWebhook({
        object: "instagram",
        entry: [{ id: "IG", messaging: [{ sender: { id: "C" }, recipient: { id: "IG" }, reaction: { mid: "m", action: "react" } }] }],
      }),
    ).toEqual({ messages: [], reads: [] });
  });
});

describe("messaging window", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");

  it("is open for 24 hours after their last message", () => {
    const state = messagingWindow("2026-11-09T00:00:00.000Z", now);
    expect(state.open).toBe(true);
    expect(state.closesAt).toBe("2026-11-10T00:00:00.000Z");
    expect(state.error).toBeNull();
  });

  it("is closed with a clear reason afterwards, and when they have never written", () => {
    const closed = messagingWindow("2026-11-08T11:59:00.000Z", now);
    expect(closed.open).toBe(false);
    expect(closed.error).toMatch(/24-hour window/);
    expect(messagingWindow(null, now).error).toMatch(/no incoming message/);
  });

  it("recognises Meta's outside-window error", () => {
    expect(outsideWindowMessage("(#10) This message is sent outside of allowed window.")).toMatch(/24-hour/);
    expect(outsideWindowMessage("nope", 2534022)).toMatch(/24-hour/);
    expect(outsideWindowMessage("temporary problem")).toBeNull();
  });
});

describe("contacts and message helpers", () => {
  const contacts = [
    { id: "1", name: "Ada", notes: "instagram.com/ada_brand", website: null },
    { id: "2", name: "ada_brand", notes: null, website: null },
    { id: "3", name: "Sam", notes: "met @ada_brand at a fair", website: null },
  ];

  it("links one clear contact and refuses an ambiguous name", () => {
    expect(pickContact([contacts[0]], "@ada_brand")).toBe("1");
    expect(pickContact(contacts, "ada_brand")).toBeNull();
    expect(pickContact([{ id: "a", name: "sam", notes: null, website: null }, { id: "b", name: "@sam", notes: null, website: null }], "sam")).toBeNull();
    expect(pickContact([{ id: "only", name: "holm_10", notes: null, website: null }], "holm_10")).toBe("only");
    expect(pickContact(contacts, "not a handle!")).toBeNull();
  });

  it("picks the other person and a short snippet", () => {
    expect(
      otherParticipant(
        [
          { id: "ig", username: "holm_10" },
          { id: "customer", username: "brand" },
        ],
        "ig",
        "page",
      )?.username,
    ).toBe("brand");
    expect(snippetFor("  Hello\nthere ", [])).toBe("Hello there");
    expect(snippetFor("", [{ type: "image", url: null }])).toBe("[image]");
    expect(draftTextError("  ")).toMatch(/Write a message/);
    expect(draftTextError("x".repeat(1001))).toMatch(/1,000 bytes/);
    expect(draftTextError("Thanks for the reply")).toBeNull();
  });
});

describe("Instagram graph calls", () => {
  it("keeps pages that are linked to a professional account", async () => {
    mockFetch(() => ({
      body: {
        data: [
          { id: "page-1", name: "HolmNordic", access_token: "page-token", instagram_business_account: { id: "ig-1", username: "holm_10" } },
          { id: "page-2", name: "Empty", access_token: "other" },
        ],
      },
    }));
    const accounts = await listLinkedInstagramAccounts(cfg, "user-token");
    expect(accounts).toEqual([
      { pageId: "page-1", pageName: "HolmNordic", pageAccessToken: "page-token", igUserId: "ig-1", igUsername: "holm_10" },
    ]);
  });

  it("reads Instagram conversations from the Page and sends a text reply as that Page", async () => {
    const calls = mockFetch((url) => {
      if (url.pathname.endsWith("/messages")) {
        return { body: { message_id: "mid-sent" } };
      }
      return {
        body: {
          data: [
            {
              id: "thread-1",
              updated_time: "2026-11-09T10:00:00+0000",
              participants: { data: [{ id: "ig-1", username: "holm_10" }, { id: "cust", username: "brand" }] },
              messages: {
                data: [
                  { id: "m1", created_time: "2026-11-09T10:00:00+0000", message: "Hi", from: { id: "cust", username: "brand" } },
                ],
              },
            },
          ],
        },
      };
    });

    const conversations = await listInstagramConversations(cfg, "page-token", "page-1", "ig-1");
    expect(conversations[0].threadId).toBe("thread-1");
    expect(conversations[0].messages[0]).toMatchObject({ externalId: "m1", direction: "inbound", text: "Hi" });

    const sent = await sendInstagramText(cfg, "page-token", "page-1", "cust", "Thanks");
    expect(sent.messageId).toBe("mid-sent");
    const sendCall = calls.find((call) => call.url.pathname.endsWith("/messages"));
    expect(sendCall?.init?.method).toBe("POST");
    expect(sendCall?.url.pathname).toContain("/page-1/messages");
    expect(JSON.parse(String(sendCall?.init?.body))).toEqual({ recipient: { id: "cust" }, message: { text: "Thanks" } });
    expect(sendCall?.url.searchParams.get("appsecret_proof")).toBeTruthy();
  });

  it("turns Meta's window error into the same explanation the admin sees", async () => {
    mockFetch(() => ({
      status: 400,
      body: { error: { message: "This message is sent outside of allowed window.", code: 10, error_subcode: 2534022 } },
    }));
    await expect(sendInstagramText(cfg, "page-token", "page-1", "cust", "Late")).rejects.toThrow(/24-hour/);
  });
});
