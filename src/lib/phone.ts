import * as Crypto from 'expo-crypto';

/** Strips everything but digits, and drops a leading country-code "1" on
 * 11-digit US-style numbers so "+1 (555) 123-4567" and "555-123-4567"
 * normalize the same way. Good enough for matching, not full E.164. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/** SHA-256 of the normalized number. This is the only form of a phone
 * number - the user's own, or anyone in their device contacts - that ever
 * leaves the device. See match_contacts() / profiles.phone_hash. */
export async function hashPhone(raw: string): Promise<string | null> {
  const normalized = normalizePhone(raw);
  if (normalized.length < 7) return null;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}
