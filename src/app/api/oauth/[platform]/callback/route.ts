import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import type { Platform } from "@/lib/env";
import { encodeFlash, FLASH_COOKIE, type Flash } from "@/lib/flash";
import { googleConfig, metaConfig } from "@/lib/ads/config";
import { discoverAdAccounts, saveConnection, syncAdAccounts } from "@/lib/ads/connections";
import { exchangeGoogleCode, getGoogleUser } from "@/lib/ads/google";
import { exchangeMetaCode, getMetaUser } from "@/lib/ads/meta";
import { appOrigin, consumeOAuthState, oauthRedirectUri } from "@/lib/ads/oauth";
import { AdPlatformError } from "@/lib/ads/types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (platform !== "meta" && platform !== "google") return new NextResponse("Not found", { status: 404 });
  await requireAdmin();

  const name = platform === "meta" ? "Meta" : "Google";
  const back = (flash: Flash) => {
    const response = NextResponse.redirect(`${appOrigin(request)}/ad-accounts`);
    response.cookies.set(FLASH_COOKIE, encodeFlash(flash), { maxAge: 60, path: "/" });
    return response;
  };

  const query = request.nextUrl.searchParams;
  if (!(await consumeOAuthState(platform, query.get("state")))) {
    return back({ kind: "error", message: `The ${name} connection took too long or didn't match. Please try again.` });
  }
  if (query.get("error")) {
    return back({ kind: "error", message: `${name} connection was cancelled.` });
  }
  const code = query.get("code");
  if (!code) return back({ kind: "error", message: `${name} didn't send back a login code. Please try again.` });

  try {
    const redirectUri = oauthRedirectUri(platform as Platform, request);
    let connection: Parameters<typeof saveConnection>[0];

    if (platform === "meta") {
      const tokens = await exchangeMetaCode(metaConfig(), code, redirectUri);
      const user = await getMetaUser(metaConfig(), tokens.accessToken);
      connection = {
        platform,
        externalUserId: user.id,
        label: user.name ?? `Meta user ${user.id}`,
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
      };
    } else {
      const tokens = await exchangeGoogleCode(googleConfig(), code, redirectUri);
      const user = await getGoogleUser(tokens.accessToken);
      connection = {
        platform,
        externalUserId: user.sub,
        label: user.email ?? `Google user ${user.sub}`,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      };
    }

    const connectionId = await saveConnection(connection);
    const accounts = await discoverAdAccounts(connection.platform, connection.accessToken);
    const { found, added } = await syncAdAccounts(connection.platform, connectionId, accounts);

    const message =
      found === 0
        ? `${name} connected as ${connection.label}, but it can't see any ad accounts yet.`
        : `${name} connected as ${connection.label}. Found ${found} ad account${found === 1 ? "" : "s"}${
            added ? ` (${added} new)` : ""
          } — assign them to clients below.`;
    return back({ kind: "success", message });
  } catch (error) {
    if (!(error instanceof AdPlatformError)) console.error(`${name} OAuth callback failed`, error);
    return back({
      kind: "error",
      message: error instanceof AdPlatformError ? error.message : `Something went wrong connecting ${name}. Please try again.`,
    });
  }
}
