import { normaliseUsername } from "@/lib/instagram/messages";

export type ContactCandidate = {
  id: string;
  name: string | null;
  notes: string | null;
  website: string | null;
};

function mentions(haystack: string | null, username: string) {
  if (!haystack) return false;
  const name = username.toLowerCase();
  const text = haystack.toLowerCase();
  if (text.includes(`instagram.com/${name}`) || text.includes(`instagr.am/${name}`)) return true;
  return new RegExp(`(^|[^a-z0-9._])@${name}(?![a-z0-9._])`, "i").test(haystack);
}

/**
 * Link a conversation to a contact only when one contact clearly is this
 * Instagram account: the handle is in their notes or website, or their name
 * is exactly the handle and nobody else shares it.
 */
export function pickContact(contacts: ContactCandidate[], username: string | null | undefined) {
  const name = normaliseUsername(username);
  if (!name) return null;
  const strong = contacts.filter((contact) => mentions(contact.notes, name) || mentions(contact.website, name));
  if (strong.length === 1) return strong[0].id;
  if (strong.length > 1) return null;
  const byName = contacts.filter((contact) => contact.name?.trim().replace(/^@/, "").toLowerCase() === name.toLowerCase());
  return byName.length === 1 ? byName[0].id : null;
}
