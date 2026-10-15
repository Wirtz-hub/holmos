const escapeMap: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Makes text safe to put inside HTML (emails). */
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => escapeMap[c]);
}
