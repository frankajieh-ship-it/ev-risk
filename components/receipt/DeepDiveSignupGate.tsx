"use client";

import { Zap } from "lucide-react";

interface DeepDiveSignupGateProps {
  onSignIn: () => void;
}

export default function DeepDiveSignupGate({ onSignIn }: DeepDiveSignupGateProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
      <button
        onClick={onSignIn}
        className="w-full flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold text-[#00d97e] hover:bg-[#00d97e]/[0.06] transition-colors"
      >
        <Zap className="w-4 h-4" />
        View Deep Dive Analysis
      </button>
    </div>
  );
}
