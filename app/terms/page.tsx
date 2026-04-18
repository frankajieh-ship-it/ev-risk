import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — OFFO",
  description: "Terms governing your use of the OFFO EV deal checker and fit check tools.",
};

const EFFECTIVE_DATE = "March 15, 2025";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/">
            <Image src="/offo-logo.png" alt="OFFO" width={120} height={48} className="h-7 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            ← Back to OFFO
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-sm text-white/40">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance</h2>
            <p>
              By using OFFO — including the website at offolab.com, any OFFO APIs, or the OFFO Chrome Extension (collectively, the &quot;Service&quot;) — you agree to these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. What OFFO Is (and Is Not)</h2>
            <p>
              OFFO provides AI-assisted analysis to help EV shoppers evaluate used car listings and assess whether an electric vehicle fits their driving routine. Our outputs are <strong className="text-white/90">informational only</strong> and are not professional financial, legal, or mechanical advice.
            </p>
            <p className="mt-3">
              OFFO does not inspect vehicles, verify seller claims, guarantee price accuracy, or assess vehicle title or history. Always conduct your own due diligence — including a pre-purchase inspection by a qualified mechanic — before buying any vehicle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Accounts</h2>
            <p>
              You may use OFFO without an account. If you create an account, you are responsible for maintaining the security of your credentials and for all activity under your account. You must be at least 13 years old to create an account.
            </p>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably believe are being used for fraud or abuse.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Paid Reports</h2>
            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">4a. Purchases</h3>
            <p>
              Certain features (full deal receipts, PDF downloads) require a one-time payment processed by Stripe. All prices are in USD. Taxes may apply depending on your location.
            </p>
            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">4b. Refunds</h3>
            <p>
              Because our reports are digital goods generated on demand, all sales are <strong className="text-white/90">final</strong> once the report has been successfully generated and delivered. If the report fails to generate due to a technical error on our end, contact us at{" "}
              <a href="mailto:support@offolab.com" className="text-[#00d97e] hover:text-[#00c970] transition-colors">support@offolab.com</a>{" "}
              within 7 days and we will re-generate it or issue a full refund at our discretion.
            </p>
            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">4c. Free Mode</h3>
            <p>
              We may offer free report access during promotional periods. We reserve the right to modify or end free access at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Chrome Extension</h2>
            <p>
              The OFFO Chrome Extension is provided as a convenience tool. It reads publicly visible listing content on cargurus.com to generate deal analysis. You may use it only for personal, non-commercial evaluation of vehicles you are considering purchasing. You may not use the extension to scrape, aggregate, or re-sell listing data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Service to generate analysis for resale or commercial lead generation without our written permission</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from our API at scale</li>
              <li>Submit false or misleading information to manipulate analysis results</li>
              <li>Interfere with the security or integrity of the Service</li>
              <li>Use the Service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              All content, software, and branding on OFFO — including the name, logo, scoring methodology, and report format — is owned by OFFO or its licensors. You may not reproduce, redistribute, or create derivative works without our written permission.
            </p>
            <p className="mt-3">
              Report outputs generated for you are licensed to you for personal use only. You may share a report PDF you purchased, but you may not sell it or use it in commercial marketing materials.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p className="uppercase text-white/50 text-sm leading-relaxed">
              The service is provided &quot;as is&quot; without warranty of any kind. To the maximum extent permitted by law, OFFO disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or that any analysis is accurate, complete, or suitable for your specific situation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p className="uppercase text-white/50 text-sm leading-relaxed">
              To the maximum extent permitted by law, OFFO shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of money, vehicle purchase losses, or data — arising from your use of or inability to use the service, even if we have been advised of the possibility of such damages.
            </p>
            <p className="mt-3 uppercase text-white/50 text-sm leading-relaxed">
              Our total liability for any claim arising from these terms or your use of the service shall not exceed the amount you paid us in the 12 months preceding the claim, or $50, whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law principles. Any disputes shall be resolved in the courts of Delaware, and you consent to personal jurisdiction there.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these Terms. When we do, we will update the effective date. Continued use of the Service after changes constitutes acceptance of the new Terms. We will provide 14 days advance notice by email for material changes to paid users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
            <p>
              Questions about these Terms?{" "}
              <a href="mailto:support@offolab.com" className="text-[#00d97e] hover:text-[#00c970] transition-colors">support@offolab.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex gap-6 text-sm text-white/30">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-white/60 transition-colors">Back to OFFO</Link>
        </div>
      </div>
    </div>
  );
}
