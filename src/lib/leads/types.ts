// Shapes shared by the lead finder's server code and its page.

export type LeadSource = "google" | "osm";

/** A business found on the map. */
export type Lead = {
  id: string;
  source: LeadSource;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  /** The CRM card this business already has, if any. */
  clientId: string | null;
};

/** What a quick look at the business's website showed. */
export type WebsiteCheck = {
  /** "none" = no website listed; "down" = listed but couldn't be opened. */
  status: "ok" | "none" | "down";
  url: string | null;
  https: boolean;
  mobileFriendly: boolean;
  metaPixel: boolean;
  googleTag: boolean;
  googleAds: boolean;
  builder: string | null;
  copyrightYear: number | null;
  seconds: number | null;
  emails: string[];
  phones: string[];
  socials: { facebook: string | null; instagram: string | null; linkedin: string | null };
};

export type LeadScore = {
  /** 0–100: how much this business looks like it needs an agency. */
  score: number;
  /** Short reasons in plain words, biggest first. */
  reasons: string[];
};

/** What the AI made of the business: who to talk to and what to say. */
export type LeadPitch = {
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  summary: string;
  angle: string;
  subject: string;
  opener: string;
};
