import { createHmac } from "node:crypto";
import { InstagramError } from "@/lib/instagram/errors";
import {
  directionFromIds,
  normaliseAttachments,
  normaliseUsername,
  toIsoTimestamp,
  type Attachment,
  type Participant,
} from "@/lib/instagram/messages";
import { outsideWindowMessage } from "@/lib/instagram/window";

// Instagram Messaging through a Facebook Page linked to a professional account.
// Docs: developers.facebook.com/docs/messenger-platform/instagram
// This login is separate from the ads login: ads use a Login-for-Business
// configuration that does not include messaging permissions.

export type InstagramConfig = { appId: string; appSecret: string; version: string; loginConfigId?: string };

export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
] as const;

const MAX_PAGES = 8;

export function instagramAuthUrl(cfg: InstagramConfig, redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${cfg.version}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  // A Login-for-Business configuration replaces the scope list. Use one only
  // when it was created for these messaging permissions, never the ads configuration.
  if (cfg.loginConfigId) url.searchParams.set("config_id", cfg.loginConfigId);
  else url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  return url.toString();
}

type GraphError = { message?: string; code?: number; error_subcode?: number };

function toError(error: GraphError | undefined, status: number): InstagramError {
  const windowMessage = outsideWindowMessage(error?.message ?? "", error?.error_subcode);
  if (windowMessage) return new InstagramError(windowMessage);
  if (error?.code === 190 || error?.code === 102 || status === 401) {
    return new InstagramError("The Instagram login has expired or was revoked. Reconnect Instagram on the Inbox page.", true);
  }
  if (error?.code === 4 || error?.code === 17 || error?.code === 32 || error?.code === 613) {
    return new InstagramError("Instagram is limiting requests right now. Try again in a few minutes.");
  }
  if (error?.code === 10 || error?.code === 200) {
    return new InstagramError(
      "This Instagram login can't read or send messages. Check the permissions on the Meta app, and that the Facebook user can message as the Page.",
    );
  }
  return new InstagramError(error?.message ? `Instagram said: ${error.message}` : `Instagram request failed (${status}).`);
}

async function graph<T>(cfg: InstagramConfig, url: URL, accessToken: string, init?: RequestInit): Promise<T> {
  url.searchParams.set("appsecret_proof", createHmac("sha256", cfg.appSecret).update(accessToken).digest("hex"));
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new InstagramError("Couldn't reach Instagram. Check your internet connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: GraphError } & T;
  if (!res.ok || body.error) throw toError(body.error, res.status);
  return body;
}

function graphUrl(cfg: InstagramConfig, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${cfg.version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function graphAll<T>(cfg: InstagramConfig, url: URL, accessToken: string): Promise<T[]> {
  const items: T[] = [];
  let next: URL | null = url;
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const body: { data?: T[]; paging?: { next?: string } } = await graph(cfg, next, accessToken);
    items.push(...(body.data ?? []));
    next = body.paging?.next ? new URL(body.paging.next) : null;
    next?.searchParams.delete("access_token");
  }
  return items;
}

export type LinkedInstagramAccount = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igUserId: string;
  igUsername: string;
};

type PageRow = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string };
  connected_instagram_account?: { id?: string; username?: string };
};

/** Pages this Facebook login can manage that are linked to an Instagram professional account. */
export async function listLinkedInstagramAccounts(cfg: InstagramConfig, userAccessToken: string) {
  const pages = await graphAll<PageRow>(
    cfg,
    graphUrl(cfg, "me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}",
      limit: "100",
    }),
    userAccessToken,
  );
  const accounts: LinkedInstagramAccount[] = [];
  for (const page of pages) {
    const ig = page.instagram_business_account?.id ? page.instagram_business_account : page.connected_instagram_account;
    const username = normaliseUsername(ig?.username);
    if (!page.id || !page.access_token || !ig?.id || !username) continue;
    accounts.push({
      pageId: page.id,
      pageName: page.name || `Page ${page.id}`,
      pageAccessToken: page.access_token,
      igUserId: ig.id,
      igUsername: username,
    });
  }
  return accounts;
}

/** Ask Meta to deliver message and read-receipt webhooks for this Page. */
export async function subscribePageToMessages(cfg: InstagramConfig, pageId: string, pageAccessToken: string) {
  await graph(
    cfg,
    graphUrl(cfg, `${pageId}/subscribed_apps`, { subscribed_fields: "messages,messaging_seen" }),
    pageAccessToken,
    { method: "POST" },
  );
}

export type RemoteMessage = {
  externalId: string;
  senderId: string | null;
  direction: "inbound" | "outbound";
  text: string | null;
  attachments: Attachment[];
  sentAt: string;
  senderUsername: string | null;
};

export type RemoteConversation = {
  threadId: string;
  updatedAt: string | null;
  participants: Participant[];
  messages: RemoteMessage[];
};

type GraphMessage = {
  id?: string;
  created_time?: string;
  message?: string;
  from?: { id?: string; username?: string };
  attachments?: unknown;
};

type GraphConversation = {
  id?: string;
  updated_time?: string;
  participants?: { data?: Participant[] };
  messages?: { data?: GraphMessage[] };
};

const CONVERSATION_FIELDS =
  "id,updated_time,participants,messages.limit(20){id,created_time,from,message,attachments}";

export async function listInstagramConversations(cfg: InstagramConfig, pageAccessToken: string, pageId: string, igUserId: string) {
  const rows = await graphAll<GraphConversation>(
    cfg,
    graphUrl(cfg, `${pageId}/conversations`, {
      platform: "instagram",
      fields: CONVERSATION_FIELDS,
      limit: "25",
    }),
    pageAccessToken,
  );

  return rows.flatMap((row): RemoteConversation[] => {
    if (!row.id) return [];
    const participants = row.participants?.data ?? [];
    const messages = (row.messages?.data ?? []).flatMap((message): RemoteMessage[] => {
      if (!message.id) return [];
      const sentAt = toIsoTimestamp(message.created_time);
      if (!sentAt) return [];
      return [
        {
          externalId: message.id,
          senderId: message.from?.id ?? null,
          senderUsername: normaliseUsername(message.from?.username),
          direction: directionFromIds(message.from?.id, igUserId, pageId),
          text: message.message ?? null,
          attachments: normaliseAttachments(message.attachments),
          sentAt,
        },
      ];
    });
    return [
      {
        threadId: row.id,
        updatedAt: toIsoTimestamp(row.updated_time),
        participants,
        messages,
      },
    ];
  });
}

export async function lookupInstagramUsername(cfg: InstagramConfig, pageAccessToken: string, igScopedId: string) {
  try {
    const profile = await graph<{ username?: string }>(
      cfg,
      graphUrl(cfg, igScopedId, { fields: "username" }),
      pageAccessToken,
    );
    return normaliseUsername(profile.username);
  } catch {
    return null;
  }
}

export async function sendInstagramText(
  cfg: InstagramConfig,
  pageAccessToken: string,
  pageId: string,
  recipientId: string,
  text: string,
) {
  const result = await graph<{ message_id?: string }>(
    cfg,
    graphUrl(cfg, `${pageId}/messages`),
    pageAccessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    },
  );
  if (!result.message_id) throw new InstagramError("Instagram accepted the request but didn't return a message id.");
  return { messageId: result.message_id };
}
