import "server-only";
import { serverEnv } from "@/lib/env";
import type { InstagramConfig } from "@/lib/instagram/graph";

export function instagramConfig(): InstagramConfig {
  const env = serverEnv();
  return {
    appId: env.metaAppId,
    appSecret: env.metaAppSecret,
    version: env.metaApiVersion,
    loginConfigId: env.metaInstagramLoginConfigId || undefined,
  };
}
