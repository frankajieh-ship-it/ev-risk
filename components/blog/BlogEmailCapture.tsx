"use client";

import EmailCaptureBar from "@/components/landing/EmailCaptureBar";

interface BlogEmailCaptureProps {
  source?: string;
}

export default function BlogEmailCapture({ source = "blog_post" }: BlogEmailCaptureProps) {
  return (
    <div className="my-10 rounded-2xl border border-white/[0.10] bg-white/[0.03] px-6 py-7 text-center">
      <p className="text-xs font-semibold text-[#00d97e]/70 uppercase tracking-wider mb-2">Free weekly alerts</p>
      <h3 className="text-base font-bold text-white mb-1">Get used EV deal alerts every Monday</h3>
      <p className="text-sm text-white/40 mb-5">
        Price drops on EVs you saved, open recalls on your shortlist, and what the market is doing. Free. No spam.
      </p>
      <EmailCaptureBar
        source={source}
        placeholder="Your email address"
        ctaText="Get alerts"
        successText="You're in. Digest lands every Monday."
        className="max-w-sm"
      />
    </div>
  );
}
