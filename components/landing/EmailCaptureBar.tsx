"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

interface EmailCaptureBarProps {
  source?: string; // for analytics (e.g. "homepage_hero", "blog_bottom")
  placeholder?: string;
  ctaText?: string;
  successText?: string;
  className?: string;
}

export default function EmailCaptureBar({
  source = "homepage",
  placeholder = "Your email — get weekly used EV deal alerts",
  ctaText = "Subscribe free",
  successText = "You're in. Digest lands every Monday.",
  className = "",
}: EmailCaptureBarProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isValid = email.includes("@") && email.includes(".");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Something went wrong — try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error — try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className={`flex items-center justify-center gap-2 py-3 ${className}`}>
        <Check className="w-4 h-4 text-[#00d97e]" />
        <span className="text-sm text-white/70">{successText}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-2 w-full max-w-md mx-auto ${className}`}>
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
        placeholder={placeholder}
        className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50 focus:ring-1 focus:ring-[#00d97e]/20 transition-colors"
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={!isValid || status === "loading"}
        className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
          isValid
            ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
            : "bg-white/10 text-white/30 cursor-not-allowed"
        }`}
      >
        {status === "loading" ? (
          <span className="w-4 h-4 border-2 border-[#0d1117]/30 border-t-[#0d1117] rounded-full animate-spin" />
        ) : (
          <>
            {ctaText}
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-400 mt-1 sm:col-span-2">{errorMsg}</p>
      )}
    </form>
  );
}
