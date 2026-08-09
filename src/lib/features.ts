// Single place to pin a feature off across every screen that touches it,
// without deleting the underlying code/schema - see LANGUAGE_SWITCHING_ENABLED
// in src/i18n/LocaleProvider.tsx for the same pattern. Phone-number contact
// matching (Profile's phone field, Search's "find friends from contacts")
// is hidden from the UI but the schema (profiles.phone_hash), RPCs
// (match_contacts), and client helpers (src/lib/phone.ts, src/lib/contacts.ts)
// are all left in place so this can be flipped back on later.
export const PHONE_CONTACTS_FEATURE_ENABLED = false;
