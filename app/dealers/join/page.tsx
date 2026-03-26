"use client";

/**
 * Dealer Sign-Up Page — /dealers/join
 *
 * Step 1 of 2: collect dealership details + email, then send magic link.
 * Signup data is stashed in localStorage so the confirm page can provision
 * the dealership after the user clicks the link in their email.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building, Check, Loader2, Mail } from "lucide-react";
import { sendMagicLink } from "@/lib/supabase-auth";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

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
}

const EMPTY: FormData = {
  dealership_name: "",
  contact_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  zip: "",
};

export default function DealerJoinPage() {
  const { isAuthenticated, isDealer, isReady } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Already a dealer? Go straight to workspace
  useEffect(() => {
    if (isReady && isAuthenticated && isDealer) {
      router.replace("/dealer");
    }
  }, [isReady, isAuthenticated, isDealer, router]);

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.dealership_name.trim()) {
      setError("Dealership name is required.");
      return;
    }
    if (!form.contact_name.trim()) {
      setError("Your name is required.");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    setSubmitting(true);

    // Stash signup data so the confirm page can provision after email click
    try {
      localStorage.setItem(
        "dealer_signup_pending",
        JSON.stringify({
          dealership_name: form.dealership_name.trim(),
          contact_name: form.contact_name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state,
          zip: form.zip.trim(),
        })
      );
      // Point auth callback → provisioning page
      localStorage.setItem("auth_redirect", "/dealers/join/confirm");
    } catch {
      // localStorage unavailable — proceed anyway; confirm page will handle gracefully
    }

    const result = await sendMagicLink(form.email.trim());
    setSubmitting(false);

    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Failed to send confirmation email.");
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500">
              We sent a confirmation link to <strong>{form.email}</strong>.
              <br />
              Click it to finish setting up your dealer account.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Don&apos;t see it? Check your spam folder.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <Link
          href="/dealers"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dealer Directory
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">List Your Dealership</h1>
          </div>
          <p className="text-sm text-gray-500">
            Join OFFO&apos;s dealer network to reach high-intent EV buyers. Free to list —
            no credit card required.
          </p>
        </div>

        {/* Value props */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 space-y-2">
          {[
            "Appear in the OFFO dealer directory",
            "Match your inventory to buyers researching those vehicles",
            "Access buyer demand analytics for your market",
          ].map((point) => (
            <div key={point} className="flex items-start gap-2 text-sm text-green-800">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
              {point}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Dealership Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.dealership_name}
                onChange={(e) => update("dealership_name", e.target.value)}
                placeholder="Green Motors EV"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Work Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="jane@greenmotors.com"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Chicago"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <select
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP Code</label>
              <input
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                placeholder="60601"
                maxLength={10}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Sending confirmation..." : "Get Started — Send Confirmation Email"}
            </button>

            <p className="text-xs text-center text-gray-400">
              Already have an account?{" "}
              <Link href="/auth/login?redirect=/dealer" className="text-green-600 hover:text-green-700 font-medium">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
