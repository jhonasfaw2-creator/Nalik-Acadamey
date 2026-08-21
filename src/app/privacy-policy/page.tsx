import { Container } from "@/components/ui/Container";
import { SITE_NAME, CONTACT } from "@/lib/constants";

export const metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `Privacy policy for ${SITE_NAME}. Learn how we collect, use, and protect your personal information.`,
};

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <Container className="max-w-3xl">
        <div className="mb-12">
          <div className="mb-5 h-1 w-10 bg-gold" />
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-navy/50">
            Last updated: August 21, 2026
          </p>
        </div>

        <div className="space-y-8 text-base leading-relaxed text-navy/70">
          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              1. Information We Collect
            </h2>
            <p>
              When you submit an application to {SITE_NAME}, we collect the
              following personal information:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-navy/60">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Age</li>
              <li>Location</li>
              <li>Educational background and experience</li>
              <li>Motivation and goals</li>
              <li>WhatsApp number (optional)</li>
              <li>Portfolio or social media links (optional)</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              2. How We Use Your Information
            </h2>
            <p>We use your personal information to:</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-navy/60">
              <li>Process and review your application</li>
              <li>Communicate with you about your application status</li>
              <li>Provide information about our programs and courses</li>
              <li>Improve our services and educational offerings</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              3. Data Protection
            </h2>
            <p>
              We take the security of your personal information seriously. Your
              data is stored securely and is only accessed by authorized team
              members who need it to process your application. We do not sell,
              trade, or rent your personal information to third parties.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              4. Data Retention
            </h2>
            <p>
              We retain your application data for as long as necessary to
              fulfill the purposes outlined in this policy. If your application
              is rejected, we may retain your data for up to 12 months for
              record-keeping purposes, after which it will be securely deleted.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              5. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-navy/60">
              <li>Request access to your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              6. Contact Us
            </h2>
            <p>
              If you have any questions about this privacy policy or how we
              handle your data, please contact us at{" "}
              <a
                href={`mailto:${CONTACT.email}`}
                className="font-medium text-gold hover:text-navy"
              >
                {CONTACT.email}
              </a>
              .
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
