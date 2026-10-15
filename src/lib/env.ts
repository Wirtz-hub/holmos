// Central place for configuration. Everything optional here degrades to a
// friendly "not set up yet" message in the UI instead of a crash.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function serverEnv() {
  return {
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
    appUrl: process.env.APP_URL ?? "",

    metaAppId: process.env.META_APP_ID ?? "",
    metaAppSecret: process.env.META_APP_SECRET ?? "",
    metaLoginConfigId: process.env.META_LOGIN_CONFIG_ID ?? "",
    metaApiVersion: process.env.META_API_VERSION ?? "v26.0",

    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    googleDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
    googleAdsApiVersion: process.env.GOOGLE_ADS_API_VERSION ?? "v25",

    resendApiKey: process.env.RESEND_API_KEY ?? "",
    emailFrom: process.env.EMAIL_FROM ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

/** Which settings are missing before Google Calendar can be connected. */
export function missingCalendarSettings(): string[] {
  const env = serverEnv();
  return (
    [
      ["SUPABASE_SECRET_KEY", env.supabaseSecretKey],
      ["TOKEN_ENCRYPTION_KEY", env.tokenEncryptionKey],
      ["GOOGLE_CLIENT_ID", env.googleClientId],
      ["GOOGLE_CLIENT_SECRET", env.googleClientSecret],
    ] as [string, string][]
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

/** Which settings are missing before HolmOS can send emails (booking confirmations, reminders). */
export function missingEmailSettings(): string[] {
  const env = serverEnv();
  return (
    [
      ["RESEND_API_KEY", env.resendApiKey],
      ["EMAIL_FROM", env.emailFrom],
    ] as [string, string][]
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export type Platform = "meta" | "google";

/** Which settings are missing before a platform can be connected. */
export function missingPlatformSettings(platform: Platform): string[] {
  const env = serverEnv();
  const required: Record<Platform, [string, string][]> = {
    meta: [
      ["META_APP_ID", env.metaAppId],
      ["META_APP_SECRET", env.metaAppSecret],
    ],
    google: [
      ["GOOGLE_CLIENT_ID", env.googleClientId],
      ["GOOGLE_CLIENT_SECRET", env.googleClientSecret],
      ["GOOGLE_ADS_DEVELOPER_TOKEN", env.googleDeveloperToken],
    ],
  };
  const shared: [string, string][] = [
    ["SUPABASE_SECRET_KEY", env.supabaseSecretKey],
    ["TOKEN_ENCRYPTION_KEY", env.tokenEncryptionKey],
  ];
  return [...shared, ...required[platform]].filter(([, value]) => !value).map(([name]) => name);
}
