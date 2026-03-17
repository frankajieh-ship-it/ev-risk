"use client";

/**
 * ListingExtractMini
 *
 * Listing URL/text paste for the compare options phase.
 * Calls /api/receipt/fetch to extract year/make/model/trim/price,
 * then calls onExtracted with the full result.
 */

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import { deriveBodyBucket, type BodyTypeBucket } from "@/lib/comparison-types";

export interface ExtractedListing {
  label: string;
  bodyType: BodyTypeBucket;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

interface Props {
  onExtracted: (result: ExtractedListing) => void;
  placeholder?: string;
}

export default function ListingExtractMini({ onExtracted, placeholder }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLabel, setSuccessLabel] = useState<string | null>(null);

  const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

  const handleExtract = async () => {
    const val = input.trim();
    if (!val) return;

    setLoading(true);
    setError(null);
    setSuccessLabel(null);

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

      const { year, make, model, trim, price } = data.fields ?? {};
      if (!make && !model) {
        setError("No vehicle found. Try a direct listing URL or paste the listing text.");
        setLoading(false);
        return;
      }

      const label = [year, make, model, trim].filter(Boolean).join(" ");
      const bodyType = deriveBodyBucket(make ?? "", model ?? "");
      setSuccessLabel(label);
      setInput("");
      onExtracted({ label, bodyType, price: price ?? undefined, year, make, model, trim });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {successLabel && (
        <p className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Extracted: {successLabel}
        </p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleExtract()}
            placeholder={placeholder ?? "Paste listing URL or text…"}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleExtract}
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Extract"}
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
