import type { Platform } from "@/lib/env";

export type { Platform };

export type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export type Goal = "lead" | "purchase" | "booking";

export type Client = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  stage: Stage;
  stage_position: number;
  deal_value: number | null;
  currency: string;
  goal: Goal;
  meta_result_action: string | null;
  google_count_all_conversions: boolean;
  notes: string | null;
  portal_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityKind =
  | "created"
  | "stage_changed"
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "ad_account_assigned"
  | "ad_account_unassigned";

export type Activity = {
  id: string;
  client_id: string;
  kind: ActivityKind;
  body: string | null;
  meta: Record<string, string | undefined>;
  created_at: string;
};

export type AdConnection = {
  id: string;
  platform: Platform;
  external_user_id: string;
  label: string;
  token_expires_at: string | null;
  status: "active" | "needs_reconnect";
  last_error: string | null;
  created_at: string;
};

export type AdAccount = {
  id: string;
  platform: Platform;
  external_account_id: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  connection_id: string | null;
  login_customer_id: string | null;
  client_id: string | null;
  is_active: boolean;
};
