import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — OFFO",
  description: "Terms governing your use of the OFFO EV deal checker and fit check tools.",
};

const EFFECTIVE_DATE = "March 15, 2025";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 mb-6 inline-block">
            ← Back to OFFO
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance</h2>
            <p>
              By using OFFO — including the website at offolab.com, any OFFO APIs, or the OFFO Chrome Extension (collectively, the "Service") — you agree to these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What OFFO Is (and Is Not)</h2>
            <p>
              OFFO provides AI-assisted analysis to help EV shoppers evaluate used car listings and assess whether an electric vehicle fits their driving routine. Our outputs are <strong>informational only</strong> and are not professional financial, legal, or mechanical advice.
            </p>
            <p className="mt-3">
              OFFO does not inspect vehicles, verify seller claims, guarantee price accuracy, or assess vehicle title or history. Always conduct your own due diligence — including a pre-purchase inspection by a qualified mechanic — before buying any vehicle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Accounts</h2>
            <p>
              You may use OFFO without an account. If you create an account, you are responsible for maintaining the security of your credentials and for all activity under your account. You must be at least 13 years old to create an account.
            </p>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably believe are being used for fraud or abuse.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Paid Reports</h2>
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">4a. Purchases</h3>
            <p>
              Certain features (full deal receipts, PDF downloads) require a one-time payment processed by Stripe. All prices are in USD. Taxes may apply depending on your location.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">4b. Refunds</h3>
            <p>
              Because our reports are digital goods generated on demand, all sales are <strong>final</strong> once the report has been successfully generated and delivered. If the report fails to generate due to a technical error on our end, contact us at{" "}
              <a href="mailto:support@offolab.com" className="text-blue-600 hover:underline">support@offolab.com</a>{" "}
              within 7 days and we will re-generate it or issue a full refund at our discretion.
            </p>
            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">4c. Free Mode</h3>
            <p>
              We may offer free report access during promotional periods. We reserve the right to modify or end free access at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Chrome Extension</h2>
            <p>
              The OFFO Chrome Extension is provided as a convenience tool. It reads publicly visible listing content on cargurus.com to generate deal analysis. You may use it only for personal, non-commercial evaluation of vehicles you are considering purchasing. You may not use the extension to scrape, aggregate, or re-sell listing data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service to generate analysis for resale or commercial lead generation without our written permission</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from our API at scale</li>
              <li>Submit false or misleading information to manipulate analysis results</li>
              <li>Interfere with the security or integrity of the Service</li>
              <li>Use the Service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
            <p>
              All content, software, and branding on OFFO — including the name, logo, scoring methodology, and report format — is owned by OFFO or its licensors. You may not reproduce, redistribute, or create derivative works without our written permission.
            </p>
            <p className="mt-3">
              Report outputs generated for you are licensed to you for personal use only. You may share a report PDF you purchased, but you may not sell it or use it in commercial marketing materials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, OFFO DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY ANALYSIS IS ACCURATE, COMPLETE, OR SUITABLE FOR YOUR SPECIFIC SITUATION.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OFFO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF MONEY, VEHICLE PURCHASE LOSSES, OR DATA — ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="mt-3">
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $50, WHICHEVER IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law principles. Any disputes shall be resolved in the courts of Delaware, and you consent to personal jurisdiction there.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these Terms. When we do, we will update the effective date. Continued use of the Service after changes constitutes acceptance of the new Terms. We will provide 14 days advance notice by email for material changes to paid users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
            <p>
              Questions about these Terms?{" "}
              <a href="mailto:support@offolab.com" className="text-blue-600 hover:underline">support@offolab.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex gap-6 text-sm text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-gray-600 transition-colors">Back to OFFO</Link>
        </div>
      </div>
    </div>
  );
}
