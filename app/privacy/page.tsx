import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — OFFO",
  description: "How OFFO collects, uses, and protects your information.",
};

const EFFECTIVE_DATE = "March 15, 2025";

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-white/40">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              OFFO (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website at{" "}
              <a href="https://offolab.com" className="text-[#00d97e] hover:text-[#00c970] transition-colors">offolab.com</a>{" "}
              and the OFFO Chrome Extension. Our service helps EV shoppers evaluate used car deals and fit their driving routine to an electric vehicle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">2a. Information you provide</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white/90">Routine questionnaire answers</strong> — driving habits, charging access, climate zone, daily mileage. Stored in your browser&apos;s local storage and, if you have an account, in our database.
              </li>
              <li>
                <strong className="text-white/90">Account information</strong> — if you create an account, we collect your email address and a hashed password. Dealer accounts also include a business name.
              </li>
              <li>
                <strong className="text-white/90">Payment information</strong> — if you purchase a paid report, payment is processed by Stripe. OFFO never sees or stores your card number. We receive a transaction ID and last-4 digits only.
              </li>
              <li>
                <strong className="text-white/90">Contact &amp; feedback</strong> — if you submit a contact form or feedback, we collect the content of your message and your email address if provided.
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">2b. Information collected automatically</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white/90">Usage events</strong> — anonymized events such as &quot;routine started,&quot; &quot;receipt viewed,&quot; or &quot;panel dismissed&quot; to understand how the product is used. These are not tied to your identity unless you are signed in.
              </li>
              <li>
                <strong className="text-white/90">Session tokens</strong> — a random token stored in your browser to associate receipt requests with your session without requiring login.
              </li>
              <li>
                <strong className="text-white/90">Standard server logs</strong> — IP address, browser type, referring URL, timestamps. Logs are retained for up to 30 days for security and debugging.
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-white/80 mt-4 mb-2">2c. Chrome Extension</h3>
            <p>
              The OFFO Chrome Extension runs only on <strong className="text-white/90">cargurus.com</strong> listing pages. It reads the visible text of the listing page (make, model, year, price, mileage) to generate a deal receipt. This text is sent to our API at offolab.com. The extension does not read any other tabs, track browsing history, or collect personal information. Your driving routine (if saved) is stored in Chrome&apos;s local extension storage on your device — it is only sent to our server when you are actively on a listing page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To generate and deliver your EV fit check results and deal receipts</li>
              <li>To personalize results using your driving routine and preferences</li>
              <li>To process payments and deliver paid reports</li>
              <li>To send transactional emails (receipt confirmation, password reset) — we do not send marketing emails without your explicit opt-in</li>
              <li>To improve the product using aggregated, anonymized usage patterns</li>
              <li>To investigate and prevent fraud, abuse, or security incidents</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. How We Share Your Information</h2>
            <p className="mb-3">We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white/90">Stripe</strong> — to process payments. Stripe&apos;s privacy policy is at{" "}
                <a href="https://stripe.com/privacy" className="text-[#00d97e] hover:text-[#00c970] transition-colors" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.
              </li>
              <li>
                <strong className="text-white/90">OpenAI</strong> — listing text and your routine context are sent to OpenAI&apos;s API to generate deal analysis. We use the API in &quot;zero data retention&quot; mode where permitted. OpenAI&apos;s privacy policy is at{" "}
                <a href="https://openai.com/policies/privacy-policy" className="text-[#00d97e] hover:text-[#00c970] transition-colors" target="_blank" rel="noopener noreferrer">openai.com/policies/privacy-policy</a>.
              </li>
              <li>
                <strong className="text-white/90">Supabase</strong> — our database and authentication provider. Data is hosted in the US. Supabase&apos;s privacy policy is at{" "}
                <a href="https://supabase.com/privacy" className="text-[#00d97e] hover:text-[#00c970] transition-colors" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>.
              </li>
              <li>
                <strong className="text-white/90">Netlify</strong> — our hosting provider. Server logs may be retained by Netlify per their data processing terms.
              </li>
              <li>
                <strong className="text-white/90">Law enforcement</strong> — if required by a valid legal process, court order, or to protect rights, property, or safety.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Anonymous session data and receipts: retained for 90 days, then automatically purged</li>
              <li>Account data: retained for as long as your account is active. Deleted within 30 days of account deletion</li>
              <li>Payment records: retained for 7 years as required by applicable tax law</li>
              <li>Server logs: retained for up to 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
            <p className="mb-3">You may:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Request a copy of the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of non-essential analytics (contact us to disable event tracking for your session)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@offolab.com" className="text-[#00d97e] hover:text-[#00c970] transition-colors">privacy@offolab.com</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies &amp; Local Storage</h2>
            <p>
              We use browser local storage (not third-party tracking cookies) to save your routine answers and session token. We do not use advertising cookies or cross-site trackers. If you use our Chrome Extension, it uses Chrome&apos;s <code className="bg-white/[0.08] text-white/70 px-1.5 py-0.5 rounded text-[0.8em]">chrome.storage.local</code> API — this data stays on your device.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Children&apos;s Privacy</h2>
            <p>
              OFFO is not directed at children under 13. We do not knowingly collect personal information from anyone under 13. If you believe we have inadvertently done so, contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Security</h2>
            <p>
              We use industry-standard measures including TLS encryption in transit, hashed passwords, and row-level security on our database. No method of transmission over the internet is 100% secure — we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this policy. When we do, we&apos;ll update the effective date at the top. If changes are material, we&apos;ll notify signed-in users by email. Continued use of OFFO after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>
              Questions about this policy?{" "}
              <a href="mailto:privacy@offolab.com" className="text-[#00d97e] hover:text-[#00c970] transition-colors">privacy@offolab.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex gap-6 text-sm text-white/30">
          <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-white/60 transition-colors">Back to OFFO</Link>
        </div>
      </div>
    </div>
  );
}
