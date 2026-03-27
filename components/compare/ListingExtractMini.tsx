"use client";

/**
 * ListingExtractMini
 *
 * Listing URL/text paste OR VIN lookup for the compare options phase.
 * URL/text calls /api/receipt/fetch; VIN calls /api/receipt/vin-lookup.
 * Both paths call onExtracted with the same result shape.
 */

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Link2, Hash } from "lucide-react";
import { deriveBodyBucket, type BodyTypeBucket } from "@/lib/comparison-types";

export interface ExtractedListing {
  label: string;
  bodyType: BodyTypeBucket;
  price?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  range_mi?: number;
  battery_kwh?: number;
  dc_fast_kw?: number;
  efficiency_mi_per_kwh?: number;
}

interface Props {
  onExtracted: (result: ExtractedListing) => void;
  placeholder?: string;
}

type InputMode = "url" | "vin";

export default function ListingExtractMini({ onExtracted, placeholder }: Props) {
  const [mode, setMode] = useState<InputMode>("url");
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
      let data: { success?: boolean; error?: string; fields?: Record<string, unknown> };

      if (mode === "vin") {
        if (val.length !== 17) {
          setError("VIN must be exactly 17 characters.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/receipt/vin-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vin: val.toUpperCase() }),
        });
        data = await res.json();
      } else {
        const body = isUrl(val) ? { url: val } : { text: val };
        const res = await fetch("/api/receipt/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json();
      }

      if (!data.success) {
        setError(data.error || "Couldn't extract vehicle info. Try typing the name instead.");
        setLoading(false);
        return;
      }

      const { year, make, model, trim, price, range_mi, battery_kwh, dc_fast_kw, efficiency_mi_per_kwh } = (data.fields ?? {}) as {
        year?: number; make?: string; model?: string; trim?: string; price?: number;
        range_mi?: number; battery_kwh?: number; dc_fast_kw?: number; efficiency_mi_per_kwh?: number;
      };

      if (!make && !model) {
        setError("No vehicle found. Try a direct listing URL, paste listing text, or enter a VIN.");
        setLoading(false);
        return;
      }

      const label = [year, make, model, trim].filter(Boolean).join(" ");
      const bodyType = deriveBodyBucket(make ?? "", model ?? "");
      setSuccessLabel(label);
      setInput("");
      onExtracted({ label, bodyType, price: price ?? undefined, year, make, model, trim, range_mi, battery_kwh, dc_fast_kw, efficiency_mi_per_kwh });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: InputMode) => {
    setMode(m);
    setInput("");
    setError(null);
    setSuccessLabel(null);
  };

  return (
    <div className="space-y-2">
      {/* Tab toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => switchMode("url")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "url" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Link2 className="w-3 h-3" />
          URL / Text
        </button>
        <button
          onClick={() => switchMode("vin")}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === "vin" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Hash className="w-3 h-3" />
          VIN
        </button>
      </div>

      {successLabel && (
        <p className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Extracted: {successLabel}
        </p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          {mode === "url" ? (
            <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          ) : (
            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => {
              const v = mode === "vin" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value;
              setInput(v);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleExtract()}
            placeholder={
              mode === "vin"
                ? "e.g. 1HGBH41JXMN109186"
                : (placeholder ?? "Paste listing URL or text…")
            }
            maxLength={mode === "vin" ? 17 : undefined}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>
        <button
          onClick={handleExtract}
          disabled={loading || !input.trim() || (mode === "vin" && input.length !== 17)}
          className="px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : mode === "vin" ? "Decode" : "Extract"}
        </button>
      </div>

      {mode === "vin" && input.length > 0 && input.length < 17 && (
        <p className="text-xs text-gray-400">{17 - input.length} characters remaining</p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
