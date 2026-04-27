"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, X } from "lucide-react";
import type { FetchedListingFields } from "@/types/receipt";

interface VinPromptProps {
  onEnriched: (fields: Partial<FetchedListingFields>, photoUrls: string[]) => void;
  onDismiss: () => void;
}

export default function VinPrompt({ onEnriched, onDismiss }: VinPromptProps) {
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    if (vin.length !== 17 || status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/receipt/vin-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "VIN not found — check it's correct and try again.");
        setStatus("error");
        return;
      }
      onEnriched(data.fields ?? {}, data.photo_urls ?? []);
    } catch {
      setError("Could not reach the server. Try again.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-white/[0.05] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00d97e] shrink-0 mt-px" />
          <p className="text-sm font-semibold text-white">Add your VIN for richer analysis</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-white/50">
        Found on the dashboard, door jamb, or listing page. We&apos;ll decode it and regenerate with richer specs.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          maxLength={17}
          placeholder="17-character VIN"
          value={vin}
          onChange={(e) => {
            setVin(e.target.value.toUpperCase());
            setError(null);
            setStatus("idle");
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
          className="flex-1 px-3 py-2 text-sm font-mono bg-white/[0.06] border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/50 outline-none uppercase tracking-wider placeholder-white/25"
          disabled={status === "loading"}
        />
        <button
          onClick={handleLookup}
          disabled={vin.length !== 17 || status === "loading"}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {status === "loading" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up…</>
          ) : (
            "Regenerate"
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
