import { LegalDocument, LegalParagraph, LegalSection } from '@/components/LegalDocument';

// See privacy.tsx for why this is English-only.
export default function TermsScreen() {
  return (
    <LegalDocument title="Terms of Service" updated="August 9, 2026">
      <LegalParagraph>
        These are the terms for using Moves. By creating an account, you agree to them.
      </LegalParagraph>

      <LegalSection heading="Who can use Moves">
        <LegalParagraph>
          You must be at least 13 years old to use Moves. You're responsible for the information
          you provide and for keeping your account credentials secure.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <LegalParagraph>
          Don't use Moves to harass, threaten, or bully anyone; impersonate another person; post
          spam or content you don't have the right to share; or use another person's location or
          contact information without their consent. Every user can block and report abusive
          accounts from that account's profile - reports are reviewed and may result in account
          removal.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Your content">
        <LegalParagraph>
          You keep ownership of the Moves, messages, photos, and other content you post. You're
          responsible for it, and for making sure you have the right to post it. We may remove
          content or accounts that violate these terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Location & meeting people">
        <LegalParagraph>
          Moves helps you organize and find in-person hangouts. Use ordinary caution when meeting
          anyone you've connected with through the app, the same as you would with anyone you meet
          online. We don't run background checks on users and can't guarantee anyone's identity or
          behavior.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Account termination">
        <LegalParagraph>
          You can delete your own account at any time from Profile → Delete account. We may
          suspend or remove accounts that violate these terms or that we determine pose a safety
          risk to others.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="No warranty">
        <LegalParagraph>
          Moves is provided "as is," without warranties of any kind. We don't guarantee the app
          will be uninterrupted, error-free, or available at all times.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <LegalParagraph>
          To the fullest extent permitted by law, Moves and its operator aren't liable for any
          indirect, incidental, or consequential damages arising from your use of the app,
          including anything that happens at a Move you attended or hosted.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <LegalParagraph>
          If these terms change, the "Last updated" date above will change with them. Continuing
          to use Moves after a change means you accept the updated terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalParagraph>Questions about these terms: scnpge@gmail.com</LegalParagraph>
      </LegalSection>
    </LegalDocument>
  );
}
