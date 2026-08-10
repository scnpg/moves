import { LegalDocument, LegalParagraph, LegalSection } from '@/components/LegalDocument';

// See privacy.tsx for why this is English-only.
export default function TermsScreen() {
  return (
    <LegalDocument title="Terms of Service" updated="August 10, 2026">
      <LegalParagraph>
        These are the terms for using Moves. By creating an account, you agree to them. If you do
        not agree, do not create an account or use the app.
      </LegalParagraph>

      <LegalSection heading="Who can use Moves">
        <LegalParagraph>
          You must be at least 18 years old to create an account or use Moves. By creating an
          account, you represent that you meet this requirement. You're responsible for the
          information you provide and for keeping your account credentials secure, and for all
          activity that happens under your account.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <LegalParagraph>
          Don't use Moves to harass, threaten, or bully anyone; impersonate another person; post
          spam, illegal content, or content you don't have the right to share; or use another
          person's location or contact information without their consent. Don't attempt to
          circumvent any safety, security, or access-control feature of the app. Every user can
          block and report abusive accounts from that account's profile - reports are reviewed and
          may result in account removal, at our discretion.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Your content">
        <LegalParagraph>
          You keep ownership of the Moves, messages, photos, and other content you post. By
          posting content, you grant us a limited license to store and display it as needed to
          operate the app. You're responsible for your content, and for making sure you have the
          right to post it. We may remove content or accounts that violate these terms, with or
          without notice.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Location & meeting people">
        <LegalParagraph>
          Moves helps you organize and find in-person hangouts. You are solely responsible for
          your interactions with other users and for your safety and conduct at any Move you
          attend or host. Use ordinary caution when meeting anyone you've connected with through
          the app, the same as you would with anyone you meet online - for example, meeting in a
          public place and telling someone else your plans. We don't run background checks on
          users and can't guarantee anyone's identity, age, or behavior, and we aren't responsible
          for the conduct of any user, on or off the app.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Account termination">
        <LegalParagraph>
          You can delete your own account at any time from Settings → Delete account. We may
          suspend or remove accounts, at any time and without notice, that violate these terms or
          that we determine pose a safety or legal risk to others or to the app.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="No warranty">
        <LegalParagraph>
          Moves is provided "as is" and "as available," without warranties of any kind, express or
          implied. We don't guarantee the app will be uninterrupted, secure, error-free, or
          available at all times, or that any Move, user, or piece of content is accurate, safe,
          or lawful.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <LegalParagraph>
          To the fullest extent permitted by law, Moves and its operator aren't liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of data,
          arising from your use of the app or your interactions with other users - including
          anything that happens at a Move you attended or hosted. To the fullest extent permitted
          by law, our total liability to you for any claim arising from these terms or your use of
          the app is limited to the amount you've paid us to use it in the past twelve months (or,
          since Moves is currently free, zero).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Indemnification">
        <LegalParagraph>
          You agree to indemnify and hold Moves and its operator harmless from any claim or demand
          - including reasonable legal fees - arising from your use of the app, your content, or
          your violation of these terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <LegalParagraph>
          If these terms change, the "Last updated" date above will change with them. Continuing
          to use Moves after a change means you accept the updated terms. If you don't agree to a
          change, stop using the app and delete your account.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalParagraph>Questions about these terms: scnpge@gmail.com</LegalParagraph>
      </LegalSection>
    </LegalDocument>
  );
}
