"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";

function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/checklist/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "footer_newsletter" }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="border-b border-white/[0.08] pb-8 mb-8">
      <div className="max-w-xl">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-[#00d97e]" />
          <h4 className="text-sm font-semibold text-white">Weekly EV insights</h4>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Get the best used EV deals, market trends, and buyer tips — free, every week.
        </p>
        {status === "done" ? (
          <p className="text-sm text-green-400 font-medium">You&apos;re in! Check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 min-w-0 px-3 py-2 bg-[#161b22] border border-white/[0.10] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d97e]"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-4 py-2 bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {status === "loading" ? "..." : "Subscribe"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p className="text-xs text-red-400 mt-1">Something went wrong — try again.</p>
        )}
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-[#0d1117] border-t border-white/[0.06] text-gray-500">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <NewsletterSignup />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Image src="/offo-logo.png" alt="OFFO" width={72} height={28} className="h-7 w-auto" />
            <p className="mt-2 text-sm leading-relaxed">
              Your trusted second opinion for used EV shopping. Know if it&apos;s a good deal before the test drive.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-widest mb-3">Product</h4>
            <ul className="space-y-2 text-[0.8125rem]">
              <li><Link href="/" className="hover:text-white transition-colors">EV Fit Check</Link></li>
              <li><Link href="/receipt" className="hover:text-white transition-colors">Listing Receipt</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/news" className="hover:text-white transition-colors">EV News Digest</Link></li>
              <li><Link href="/for-dealers" className="hover:text-white transition-colors">For Dealers</Link></li>
            </ul>
            <h4 className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-5">Free Tools</h4>
            <ul className="space-y-2 text-[0.8125rem]">
              <li><Link href="/tools/warranty" className="hover:text-white transition-colors">Battery Warranty Checker</Link></li>
              <li><Link href="/tools/charging-time" className="hover:text-white transition-colors">Charging Time Calculator</Link></li>
              <li><Link href="/tools/tco" className="hover:text-white transition-colors">EV vs Gas Cost Calculator</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-[0.6875rem] font-semibold text-gray-400 uppercase tracking-widest mb-3">Support</h4>
            <ul className="space-y-2 text-[0.8125rem]">
              <li><Link href="/methodology" className="hover:text-white transition-colors">How OFFO works</Link></li>
              <li><Link href="/answers" className="hover:text-white transition-colors">EV FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 text-center text-[0.75rem] text-gray-600">
          &copy; {new Date().getFullYear()} OFFO. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
