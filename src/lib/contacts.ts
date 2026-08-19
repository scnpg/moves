import { Platform } from 'react-native';
// expo-contacts's top-level getContactsAsync/requestPermissionsAsync now
// throw ("deprecated, use the class-based API or expo-contacts/legacy")
// instead of just warning - the legacy submodule keeps the same API shape
// this file already uses.
import * as Contacts from 'expo-contacts/legacy';

import { hashPhone } from '@/lib/phone';

/**
 * Returns hashed phone numbers from the device address book, or null if
 * unavailable/denied (no Contacts API on web, permission refused, etc).
 * Raw numbers stay in memory only long enough to hash - nothing is
 * persisted locally or sent anywhere except as SHA-256 hashes.
 */
export async function getDeviceContactPhoneHashes(): Promise<string[] | null> {
  if (Platform.OS === 'web') return null;

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const numbers = new Set<string>();
  for (const contact of data) {
    for (const phone of contact.phoneNumbers ?? []) {
      if (phone.number) numbers.add(phone.number);
    }
  }

  const hashes = await Promise.all(Array.from(numbers).map(hashPhone));
  return hashes.filter((hash): hash is string => hash != null);
}

export interface DeviceContactEntry {
  name: string;
  phone: string;
  hash: string;
}

/**
 * Structured sibling of getDeviceContactPhoneHashes() that also keeps each
 * contact's display name and original phone number in memory - never
 * persisted or sent anywhere, same as above, only the hash crosses the
 * network via match_contacts(). Lets the caller diff the full contact list
 * against the matched accounts to find who to show an "invite" action for.
 */
export async function getDeviceContactsWithHashes(): Promise<DeviceContactEntry[] | null> {
  if (Platform.OS === 'web') return null;

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  // One row per person, not per phone number - a contact with a mobile and
  // a home number should only show up once in the invite list, so just
  // take their first number.
  const candidates: Array<{ name: string; phone: string }> = [];
  const seenPhones = new Set<string>();
  for (const contact of data) {
    const name = contact.name?.trim();
    const phone = contact.phoneNumbers?.find((p) => !!p.number)?.number;
    if (!name || !phone || seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    candidates.push({ name, phone });
  }

  const hashes = await Promise.all(candidates.map((c) => hashPhone(c.phone)));
  const seenHashes = new Set<string>();
  const entries: DeviceContactEntry[] = [];
  candidates.forEach((c, i) => {
    const hash = hashes[i];
    if (!hash || seenHashes.has(hash)) return;
    seenHashes.add(hash);
    entries.push({ ...c, hash });
  });
  return entries;
}

interface WebContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<Array<{ tel?: string[] }>>;
}

/** Web Contact Picker API (https://developer.mozilla.org/docs/Web/API/Contact_Picker_API) - Android Chrome only, no iOS Safari or desktop support. */
export function isWebContactPickerAvailable(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as unknown as { contacts?: WebContactsManager }).contacts?.select === 'function'
  );
}

/** Same contract as getDeviceContactPhoneHashes(): hashed numbers, or null if unavailable/cancelled. */
export async function getWebContactPhoneHashes(): Promise<string[] | null> {
  if (!isWebContactPickerAvailable()) return null;

  const contactsApi = (navigator as unknown as { contacts: WebContactsManager }).contacts;
  let picked: Array<{ tel?: string[] }>;
  try {
    picked = await contactsApi.select(['tel'], { multiple: true });
  } catch {
    return null; // user dismissed the picker, or denied permission
  }

  const numbers = new Set<string>();
  for (const contact of picked) {
    for (const tel of contact.tel ?? []) numbers.add(tel);
  }

  const hashes = await Promise.all(Array.from(numbers).map(hashPhone));
  return hashes.filter((hash): hash is string => hash != null);
}
