import "server-only";
import { serverEnv } from "@/lib/env";

/** A full address on HolmOS (e.g. https://holmos.vercel.app/f/offer), or just the path before APP_URL is set. */
export function appAddress(path: string) {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = serverEnv().appUrl || (vercel ? `https://${vercel}` : "");
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Where visitors find a funnel: its own domain if it has one, otherwise /f/<slug> on HolmOS. */
export function funnelAddress(funnel: { slug: string; custom_domain: string | null }) {
  return funnel.custom_domain ? `https://${funnel.custom_domain}` : appAddress(`/f/${funnel.slug}`);
}
