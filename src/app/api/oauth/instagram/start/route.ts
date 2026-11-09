import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { missingInstagramSettings } from "@/lib/env";
import { encodeFlash, FLASH_COOKIE } from "@/lib/flash";
import { appOrigin, createOAuthState } from "@/lib/ads/oauth";
import { instagramConfig } from "@/lib/instagram/config";
import { instagramAuthUrl } from "@/lib/instagram/graph";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const missing = missingInstagramSettings();
  if (missing.length) {
    const response = NextResponse.redirect(`${appOrigin(request)}/inbox`);
    response.cookies.set(
      FLASH_COOKIE,
      encodeFlash({
        kind: "error",
        message: `Instagram isn't set up yet. Missing settings: ${missing.join(", ")}. See the setup guide.`,
      }),
      { maxAge: 60, path: "/" },
    );
    return response;
  }

  const state = await createOAuthState("instagram", "/api/oauth/instagram");
  const redirectUri = `${appOrigin(request)}/api/oauth/instagram/callback`;
  return NextResponse.redirect(instagramAuthUrl(instagramConfig(), redirectUri, state));
}
