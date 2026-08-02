import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

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
