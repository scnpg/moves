import { LegalDocument, LegalParagraph, LegalSection } from '@/components/LegalDocument';

// English-only, unlike the rest of the app - translating legal text risks
// subtle mismatches with the operative English version, and a single
// canonical version is standard practice (and what App Store Connect /
// Play Console link to regardless of the UI's language). Content here is
// a factual description of what supabase/migrations actually stores and
// what src/features/*/api.ts actually sends - keep it in sync if either
// changes.
export default function PrivacyScreen() {
  return (
    <LegalDocument title="Privacy Policy" updated="August 9, 2026">
      <LegalParagraph>
        This policy explains what Moves collects, why, and how to delete it. Moves is a small,
        independently-run app - there is no ad network, no analytics SDK, and nothing here is sold
        to anyone.
      </LegalParagraph>

      <LegalSection heading="Account information">
        <LegalParagraph>
          Creating an account requires an email address, a username, and a password. You may
          optionally add a display name, a profile photo, and a short bio. Your password is
          handled by our authentication provider (Supabase Auth) and is never stored or seen by us
          in plain text.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Location">
        <LegalParagraph>
          If you grant location permission, Moves uses your device's location to show nearby public
          Moves and people, and to set the location of Moves you host. Your approximate last-known
          location is stored on your profile only while location features are in use; it drives
          discovery features and is not shared with any third party.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Phone number & contacts">
        <LegalParagraph>
          If you add a phone number so contacts can find you, only a one-way cryptographic hash of
          that number is ever stored - never the number itself, and it cannot be reversed back into
          a phone number. The "find friends from contacts" feature works the same way in reverse:
          your device's contacts are hashed on your own device before anything is sent to our
          servers, so raw contact numbers never leave your phone.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Content you create">
        <LegalParagraph>
          Moves you host, their descriptions, chat messages sent inside a Move, friend
          relationships, and any reports you file are all stored to make the app work. Move chat is
          ephemeral: once a Move ends, it and its messages are automatically and permanently deleted
          shortly afterward.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Safety reports">
        <LegalParagraph>
          If you report another user, the report (who filed it, who it's about, the reason, and any
          details you add) is stored so it can be reviewed. Reports are not visible to other users,
          including the person being reported.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Deleting your data">
        <LegalParagraph>
          You can permanently delete your account at any time from Profile → Delete account. This
          immediately and permanently removes your profile, Moves you host, friendships, messages,
          and profile photo. This cannot be undone. You can also block another user (Profile of that
          user → Block) at any time, which is reversible.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Children">
        <LegalParagraph>
          Moves is not directed at children under 13, and we don't knowingly collect information
          from anyone under that age. If you believe a child has created an account, contact us
          below and we'll remove it.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <LegalParagraph>
          If this policy changes, the "Last updated" date above will change with it.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalParagraph>For questions, deletion requests, or anything else: scnpge@gmail.com</LegalParagraph>
      </LegalSection>
    </LegalDocument>
  );
}
