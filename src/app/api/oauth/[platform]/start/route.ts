import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { missingPlatformSettings, type Platform } from "@/lib/env";
import { encodeFlash, FLASH_COOKIE } from "@/lib/flash";
import { googleConfig, metaConfig } from "@/lib/ads/config";
import { googleAuthUrl } from "@/lib/ads/google";
import { metaAuthUrl } from "@/lib/ads/meta";
import { appOrigin, createOAuthState, oauthRedirectUri } from "@/lib/ads/oauth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (platform !== "meta" && platform !== "google") return new NextResponse("Not found", { status: 404 });
  await requireAdmin();

  const missing = missingPlatformSettings(platform as Platform);
  if (missing.length) {
    const response = NextResponse.redirect(`${appOrigin(request)}/ad-accounts`);
    response.cookies.set(
      FLASH_COOKIE,
      encodeFlash({
        kind: "error",
        message: `${platform === "meta" ? "Meta" : "Google"} isn't set up yet. Missing settings: ${missing.join(", ")}. See the setup guide.`,
      }),
      { maxAge: 60, path: "/" },
    );
    return response;
  }

  const state = await createOAuthState(platform);
  const redirectUri = oauthRedirectUri(platform, request);
  const url =
    platform === "meta"
      ? metaAuthUrl(metaConfig(), redirectUri, state)
      : googleAuthUrl(googleConfig(), redirectUri, state);
  return NextResponse.redirect(url);
}
