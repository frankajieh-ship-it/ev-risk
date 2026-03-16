"use client";

/**
 * ListingExtractMini
 *
 * Lightweight listing URL/text paste for the compare options phase.
 * Calls /api/receipt/fetch to extract year/make/model, then calls onExtracted.
 */

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import type { BodyTypeBucket } from "@/lib/comparison-types";

interface Props {
  onExtracted: (label: string, bodyType?: BodyTypeBucket) => void;
}

function inferBodyType(make: string, model: string): BodyTypeBucket {
  const s = `${make} ${model}`.toLowerCase();
  if (/\b(suv|crossover|model y|model x|ioniq 5|ioniq 7|ioniq 9|ev6|ev9|mach-e|blazer|equinox|ariya|bz4x|id\.4|id\.6|enyaq|qx60|tiguan|forester|outback|rav4|cr-v|tucson|sportage|palisade|telluride|atlas|highlander|pilot|rdx|mdx|gx|rx|nx)\b/.test(s)) {
    return 'SUV_CUV';
  }
  if (/\b(van|pickup|f-150|f150|silverado|r1t|ram|canyon|colorado|transit|promaster|rivian r1t)\b/.test(s)) {
    return 'VAN_PICKUP';
  }
  return 'HATCH_SEDAN_WAGON';
}

export default function ListingExtractMini({ onExtracted }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

  const handleExtract = async () => {
    const val = input.trim();
    if (!val) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const body = isUrl(val) ? { url: val } : { text: val };
      const res = await fetch("/api/receipt/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Couldn't extract vehicle info. Try typing the name instead.");
        setLoading(false);
        return;
      }

      const { year, make, model } = data.fields ?? {};
      if (!make && !model) {
        setError("No vehicle found. Try a direct listing URL or paste the listing text.");
        setLoading(false);
        return;
      }

      const label = [year, make, model].filter(Boolean).join(" ");
      const bodyType = inferBodyType(make ?? "", model ?? "");
      setSuccess(true);
      setInput("");
      onExtracted(label, bodyType);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) return null; // Collapses after success

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleExtract()}
            placeholder="Paste listing URL or text…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleExtract}
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Extract
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
