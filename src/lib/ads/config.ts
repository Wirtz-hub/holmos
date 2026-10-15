import "server-only";
import { serverEnv } from "@/lib/env";
import type { GoogleConfig } from "@/lib/ads/google";
import type { MetaConfig } from "@/lib/ads/meta";

export function metaConfig(): MetaConfig {
  const env = serverEnv();
  return {
    appId: env.metaAppId,
    appSecret: env.metaAppSecret,
    version: env.metaApiVersion,
    loginConfigId: env.metaLoginConfigId || undefined,
  };
}

export function googleConfig(): GoogleConfig {
  const env = serverEnv();
  return {
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    developerToken: env.googleDeveloperToken,
    version: env.googleAdsApiVersion,
  };
}
