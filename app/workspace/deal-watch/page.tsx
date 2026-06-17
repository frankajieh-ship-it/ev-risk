"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export default function DealWatchPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-5 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
        <Bell className="w-5 h-5 text-white/30" />
      </div>
      <h1 className="text-lg font-semibold text-white mb-2">Deal Watch is coming soon</h1>
      <p className="text-sm text-white/40 max-w-sm mb-6">
        We&apos;re rebuilding Deal Watch with better alert logic and smarter price tracking. Check back soon.
      </p>
      <Link
        href="/workspace"
        className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white text-sm transition-colors"
      >
        ← Back to workspace
      </Link>
    </div>
  );
}
