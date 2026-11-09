import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { encodeFlash, FLASH_COOKIE, type Flash } from "@/lib/flash";
import { appOrigin, consumeOAuthState } from "@/lib/ads/oauth";
import { exchangeMetaCode, getMetaUser } from "@/lib/ads/meta";
import { metaConfig } from "@/lib/ads/config";
import { instagramConfig } from "@/lib/instagram/config";
import { InstagramError } from "@/lib/instagram/errors";
import { listLinkedInstagramAccounts, subscribePageToMessages } from "@/lib/instagram/graph";
import { saveInstagramConnection } from "@/lib/instagram/store";
import { syncInstagramConnection } from "@/lib/instagram/sync";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  await requireAdmin();
  const back = (flash: Flash) => {
    const response = NextResponse.redirect(`${appOrigin(request)}/inbox`);
    response.cookies.set(FLASH_COOKIE, encodeFlash(flash), { maxAge: 60, path: "/" });
    return response;
  };

  const query = request.nextUrl.searchParams;
  if (!(await consumeOAuthState("instagram", query.get("state"), "/api/oauth/instagram"))) {
    return back({ kind: "error", message: "The Instagram connection took too long or didn't match. Please try again." });
  }
  if (query.get("error")) return back({ kind: "error", message: "Instagram connection was cancelled." });
  const code = query.get("code");
  if (!code) return back({ kind: "error", message: "Instagram didn't send back a login code. Please try again." });

  try {
    const redirectUri = `${appOrigin(request)}/api/oauth/instagram/callback`;
    const tokens = await exchangeMetaCode(metaConfig(), code, redirectUri);
    const user = await getMetaUser(metaConfig(), tokens.accessToken);
    const accounts = await listLinkedInstagramAccounts(instagramConfig(), tokens.accessToken);
    if (!accounts.length) {
      return back({
        kind: "error",
        message:
          "That Facebook login has no Page linked to an Instagram professional account. Switch the Instagram account to Business or Creator, link a Facebook Page, and try again.",
      });
    }

    const names: string[] = [];
    const warnings: string[] = [];
    for (const account of accounts) {
      const saved = await saveInstagramConnection({
        externalUserId: user.id,
        label: user.name ?? `Facebook user ${user.id}`,
        igUserId: account.igUserId,
        igUsername: account.igUsername,
        pageId: account.pageId,
        pageName: account.pageName,
        userAccessToken: tokens.accessToken,
        pageAccessToken: account.pageAccessToken,
        expiresAt: tokens.expiresAt,
      });
      names.push(`@${saved.ig_username}`);
      try {
        await subscribePageToMessages(instagramConfig(), account.pageId, account.pageAccessToken);
      } catch (error) {
        warnings.push(
          error instanceof InstagramError
            ? `@${account.igUsername}: ${error.message}`
            : `@${account.igUsername}: couldn't subscribe to message notifications.`,
        );
      }
      try {
        await syncInstagramConnection(saved.id);
      } catch (error) {
        warnings.push(error instanceof InstagramError ? `@${account.igUsername}: ${error.message}` : `@${account.igUsername}: the first sync failed.`);
      }
    }

    const connected = `Instagram connected for ${names.join(", ")}.`;
    return back({
      kind: warnings.length ? "error" : "success",
      message: warnings.length ? `${connected} ${warnings.join(" ")}` : `${connected} Recent conversations are below. Replies are never sent on their own.`,
    });
  } catch (error) {
    if (!(error instanceof InstagramError)) console.error("Instagram OAuth callback failed", error);
    return back({
      kind: "error",
      message: error instanceof InstagramError ? error.message : "Something went wrong connecting Instagram. Please try again.",
    });
  }
}
