import { syncAdInsights } from "@/lib/ads/sync";
import { authorisedCron } from "@/lib/cron";
import { json } from "@/lib/request";

// Daily ad performance copy. Vercel calls this with the CRON_SECRET bearer
// (see vercel.json). The same secret already guards booking reminders.
// Reads Meta (and Google only when that sync is switched on). Never writes
// back to either platform.

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!authorisedCron(request)) return json({ ok: false }, 401);
  try {
    const result = await syncAdInsights();
    console.info(`Ad insight sync: ${result.message}`);
    // 500 after every account was attempted, so the cron log shows the failure
    // without abandoning the accounts that were still readable.
    return json(
      {
        ok: result.ok,
        skipped: result.skipped ?? null,
        message: result.message,
        accounts: result.accounts.map((account) => ({
          id: account.accountId,
          name: account.name,
          platform: account.platform,
          status: account.status,
          rows: account.rows,
          message: account.message,
          range: account.range,
        })),
      },
      result.ok ? 200 : 500,
    );
  } catch (error) {
    console.error("Ad insight sync failed", error);
    return json({ ok: false }, 500);
  }
}
