// Single place to pin a feature off across every screen that touches it,
// without deleting the underlying code/schema - see LANGUAGE_SWITCHING_ENABLED
// in src/i18n/LocaleProvider.tsx for the same pattern. Phone-number contact
// matching (Profile's phone field, Search's "find friends from contacts" +
// "invite to Moves" sections) needs this on: match_contacts() only ever
// finds people who've opted in via Profile's phone field, so the feature
// is pointless while that field is hidden.
export const PHONE_CONTACTS_FEATURE_ENABLED = true;
