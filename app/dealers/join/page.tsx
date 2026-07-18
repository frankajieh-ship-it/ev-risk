"use client";

/**
 * Dealer Sign-Up Page — /dealers/join
 * Step 1 of 2: collect dealership details + email, then send magic link.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Building, Check, Loader2, Mail, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

interface FormData {
  dealership_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  inventory_size: string;
  ev_focus: string;
}

const EMPTY: FormData = {
  dealership_name: "",
  contact_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  zip: "",
  website: "",
  inventory_size: "",
  ev_focus: "",
};

const inputCls = "w-full px-3 py-2.5 bg-[#0d1117] border border-white/[0.10] rounded-xl text-sm text-white placeholder:text-white/25 focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/40 outline-none transition-colors";
const labelCls = "block text-xs font-medium text-white/50 mb-1";

const VALID_TIERS = ["starter", "growth", "pro"] as const;
type DealerTier = typeof VALID_TIERS[number];

export default function DealerJoinPage() {
  const { isAuthenticated, isDealer, isReady } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trackEvent } = useEventTracking();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isReady && isAuthenticated && isDealer) {
      router.replace("/dealer");
    }
  }, [isReady, isAuthenticated, isDealer, router]);

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.dealership_name.trim()) { setError("Dealership name is required."); return; }
    if (!form.contact_name.trim()) { setError("Your name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.inventory_size) { setError("Please select your EV inventory size."); return; }
    if (!form.ev_focus) { setError("Please select your EV focus type."); return; }

    setSubmitting(true);

    trackEvent("dealer_signup_started", {
      has_phone: !!form.phone.trim(),
      has_location: !!(form.city.trim() || form.zip.trim()),
    });

    const rawTier = searchParams.get("tier") ?? "";
    const tier: DealerTier | "" = VALID_TIERS.includes(rawTier as DealerTier) ? (rawTier as DealerTier) : "";

    try {
      localStorage.setItem("dealer_signup_pending", JSON.stringify({
        dealership_name: form.dealership_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        inventory_size: form.inventory_size,
        ev_focus: form.ev_focus,
        city: form.city.trim(),
        state: form.state,
        zip: form.zip.trim(),
      }));
      if (tier) localStorage.setItem("dealer_signup_tier", tier);
      localStorage.setItem("auth_redirect", "/dealers/join/confirm");
      if (logoPreview) localStorage.setItem("dealer_signup_logo", logoPreview);
      else localStorage.removeItem("dealer_signup_logo");
    } catch { /* localStorage unavailable */ }

    let success = false;
    let errorMsg = "";
    try {
      const res = await fetch("/api/dealer/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), dealership_name: form.dealership_name.trim() }),
      });
      const data = await res.json();
      success = data.success;
      errorMsg = data.error || "Failed to send confirmation email.";
    } catch {
      errorMsg = "Network error. Please try again.";
    }

    setSubmitting(false);

    if (success) {
      trackEvent("dealer_signup_email_sent", { has_phone: !!form.phone.trim(), has_location: !!(form.city.trim() || form.zip.trim()) });
      setSent(true);
    } else {
      trackEvent("dealer_signup_email_failed");
      setError(errorMsg);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col">
        <Header variant="homepage" />
        <div className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-sm w-full bg-[#161b22] rounded-2xl border border-white/[0.08] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-[#00d97e]" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Check your inbox</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              We sent a confirmation link to <span className="text-white font-medium">{form.email}</span>.
              <br />Click it to finish setting up your dealer account.
            </p>
            <p className="text-xs text-white/25 mt-4">Don&apos;t see it? Check your spam folder.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col text-white">
      <Header variant="homepage" />

      {/* Page body */}
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 pt-14 pb-10 text-center">
          <Link
            href="/for-dealers"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-8 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to dealer overview
          </Link>
          <div className="flex justify-center mb-5">
            <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-32 h-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            List Your Dealership
          </h1>
          <p className="text-white/50 text-base max-w-md mx-auto leading-relaxed">
            Join OFFO&apos;s dealer network and get discovered by high-intent EV buyers actively researching vehicles like yours.
          </p>
        </section>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-8 pb-10">
          {[
            "Free to apply",
            "Reviewed within 1 business day",
            "Cancel anytime",
          ].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-xs text-[#00d97e]/80">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              {t}
            </div>
          ))}
        </div>

        {/* Form + sidebar */}
        <div className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

            {/* Form card */}
            <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#00d97e]/15 border border-[#00d97e]/25 flex items-center justify-center flex-shrink-0">
                  <Building className="w-4.5 h-4.5 text-[#00d97e]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Dealership details</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Dealership Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.dealership_name}
                      onChange={(e) => update("dealership_name", e.target.value)}
                      placeholder="Green Motors EV"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.contact_name}
                      onChange={(e) => update("contact_name", e.target.value)}
                      placeholder="Jane Smith"
                      required
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Work Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="jane@greenmotors.com"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>City</label>
                    <input
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="Chicago"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <select
                      value={form.state}
                      onChange={(e) => update("state", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>ZIP Code</label>
                  <input
                    value={form.zip}
                    onChange={(e) => update("zip", e.target.value)}
                    placeholder="60601"
                    maxLength={10}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Dealership Website</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    placeholder="www.greenmotors.com"
                    className={inputCls}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      EV Inventory Size <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.inventory_size}
                      onChange={(e) => update("inventory_size", e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="">Select range</option>
                      <option value="1-5">1–5 EVs</option>
                      <option value="6-20">6–20 EVs</option>
                      <option value="21-50">21–50 EVs</option>
                      <option value="51+">51+ EVs</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      EV Focus <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.ev_focus}
                      onChange={(e) => update("ev_focus", e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="">Select type</option>
                      <option value="ev_only">EV only</option>
                      <option value="ev_primary">Mostly EVs</option>
                      <option value="mixed">Mixed (EV + ICE)</option>
                      <option value="expanding">Expanding into EVs</option>
                    </select>
                  </div>
                </div>

                {/* Logo upload */}
                <div>
                  <label className={labelCls}>
                    Dealership Logo <span className="text-white/25 font-normal">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden relative">
                      {logoPreview ? (
                        <>
                          <Image src={logoPreview} alt="Logo preview" fill className="object-cover" unoptimized />
                          <button
                            type="button"
                            onClick={() => { setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-[#161b22] rounded-full border border-white/[0.10] flex items-center justify-center hover:bg-red-500/20 transition-colors"
                          >
                            <X className="w-3 h-3 text-white/60" />
                          </button>
                        </>
                      ) : (
                        <Building className="w-6 h-6 text-white/20" />
                      )}
                    </div>
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/80 text-xs font-medium rounded-lg border border-white/[0.08] transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {logoPreview ? "Change logo" : "Upload logo"}
                      </button>
                      <p className="text-xs text-white/25 mt-1">JPEG, PNG or WebP · Max 2MB</p>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00c970] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Sending confirmation…" : "Apply for dealer access"}
                </button>

                <p className="text-xs text-center text-white/30">
                  Already have an account?{" "}
                  <Link href="/auth/login?redirect=/dealer" className="text-[#00d97e] hover:text-[#00c970] font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </form>
            </div>

            {/* Sidebar — what you get */}
            <div className="space-y-4">
              <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
                <h3 className="text-sm font-semibold text-white mb-4">What you get</h3>
                <ul className="space-y-3">
                  {[
                    { icon: "🔍", title: "Buyer discovery", desc: "Appear to buyers actively researching your makes and models" },
                    { icon: "📨", title: "Direct leads", desc: "Receive buyer inquiries straight to your dashboard" },
                    { icon: "✅", title: "OFFO Verified badge", desc: "Display a verified dealer badge on every listing" },
                    { icon: "📊", title: "Market pricing", desc: "Live comparable pricing for every vehicle in inventory" },
                  ].map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white/90">{item.title}</p>
                        <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
                <h3 className="text-sm font-semibold text-white mb-3">How it works</h3>
                <ol className="space-y-3">
                  {[
                    { n: "01", label: "Apply", desc: "Submit your details — takes under 2 minutes" },
                    { n: "02", label: "Get approved", desc: "We review within 1 business day" },
                    { n: "03", label: "Access dashboard", desc: "Manage inventory, view buyer demand, track leads" },
                  ].map((step) => (
                    <li key={step.n} className="flex gap-3 items-start">
                      <span className="text-[#00d97e] font-bold text-xs font-mono mt-0.5 w-5 flex-shrink-0">{step.n}</span>
                      <div>
                        <p className="text-sm font-medium text-white/90">{step.label}</p>
                        <p className="text-xs text-white/40">{step.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
