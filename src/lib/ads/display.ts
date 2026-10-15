export function formatCustomerId(id: string) {
  return id.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
}

/** Account IDs the way each platform shows them (Google: 123-456-7890). */
export function displayAccountId(account: { platform: string; external_account_id: string }) {
  return account.platform === "google" ? formatCustomerId(account.external_account_id) : account.external_account_id;
}

export const platformName = (platform: string) => (platform === "google" ? "Google" : "Meta");
