import { Container } from "@/components/ui/Container";
import { SITE_NAME, CONTACT } from "@/lib/constants";

export const metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description: `Terms and conditions for enrolling in ${SITE_NAME} programs.`,
};

export default function TermsOfServicePage() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <Container className="max-w-3xl">
        <div className="mb-12">
          <div className="mb-5 h-1 w-10 bg-gold" />
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-navy/50">
            Last updated: August 21, 2026
          </p>
        </div>

        <div className="space-y-8 text-base leading-relaxed text-navy/70">
          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              1. Acceptance of Terms
            </h2>
            <p>
              By submitting an application to {SITE_NAME}, you agree to these
              Terms of Service. If you do not agree with any part of these
              terms, please do not submit an application.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              2. Program Enrollment
            </h2>
            <p>
              Submitting an application does not guarantee enrollment. All
              applications are reviewed by our team, and acceptance is at the
              sole discretion of {SITE_NAME}. We reserve the right to accept or
              reject any application based on our selection criteria.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              3. Program Fees
            </h2>
            <p>
              Program fees, if applicable, will be communicated to accepted
              students before enrollment. {SITE_NAME} reserves the right to
              change fees at any time. Payment terms will be specified in the
              enrollment agreement.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              4. Student Responsibilities
            </h2>
            <p>Students are expected to:</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-navy/60">
              <li>Attend classes and complete assignments on time</li>
              <li>Treat instructors and fellow students with respect</li>
              <li>Follow the academy&apos;s code of conduct</li>
              <li>Provide accurate information in their application</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              5. Intellectual Property
            </h2>
            <p>
              Students retain ownership of their creative work produced during
              the program. {SITE_NAME} may showcase student work for
              promotional purposes with the student&apos;s consent.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              6. Limitation of Liability
            </h2>
            <p>
              {SITE_NAME} provides education and training services. We do not
              guarantee specific employment outcomes or income levels after
              program completion. Our liability is limited to the fees paid for
              the program.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              7. Changes to Terms
            </h2>
            <p>
              {SITE_NAME} reserves the right to modify these terms at any time.
              Changes will be posted on this page with an updated revision date.
              Continued use of our services after changes constitutes acceptance
              of the new terms.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-bold text-navy">
              8. Contact
            </h2>
            <p>
              For questions about these terms, contact us at{" "}
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
