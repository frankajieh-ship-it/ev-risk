/**
 * VinCheckSection — VIN decode + mismatch detection + recall link
 *
 * After generating a receipt, users can enter a VIN to decode it via
 * NHTSA vPIC, see year/make/model/engine, get mismatch warnings,
 * and link out to NHTSA recall checker.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Info,
} from "lucide-react";

interface DecodedVin {
  year: number;
  make: string;
  model: string;
  trim: string;
  engine: string;
  drive_type: string;
  fuel_type: string;
  body_class: string;
  plant_country: string;
}

interface VinMismatch {
  field: string;
  listing_value: string;
  decoded_value: string;
}

interface VinCheckSectionProps {
  receiptId: string;
  receiptToken: string;
  listingYear?: number;
  listingMake?: string;
  listingModel?: string;
  existingVin?: string;
  trackEvent: (name: string, data?: { [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[] }) => void | Promise<void>;
}

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

const FIELD_LABELS: Record<string, string> = {
  year: "Year",
  make: "Make",
  model: "Model",
};

export default function VinCheckSection({
  receiptId,
  receiptToken,
  listingYear,
  listingMake,
  listingModel,
  existingVin,
  trackEvent,
}: VinCheckSectionProps) {
  const [vin, setVin] = useState(existingVin?.toUpperCase() || "");
  const [isDecoding, setIsDecoding] = useState(false);
  const [decoded, setDecoded] = useState<DecodedVin | null>(null);
  const [mismatches, setMismatches] = useState<VinMismatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recallUrl, setRecallUrl] = useState<string | null>(null);

  const autoDecodeRef = useRef(false);

  // Auto-decode if existingVin is provided
  useEffect(() => {
    if (existingVin && VIN_REGEX.test(existingVin) && !autoDecodeRef.current && !decoded) {
      autoDecodeRef.current = true;
      handleDecode(existingVin.toUpperCase());
    }
  }, [existingVin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVinInput = (value: string) => {
    // Uppercase and strip non-valid chars
    const cleaned = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, "");
    setVin(cleaned);
    setError(null);
  };

  const isValid = VIN_REGEX.test(vin);

  const handleDecode = async (vinOverride?: string) => {
    const targetVin = vinOverride || vin;
    if (!VIN_REGEX.test(targetVin)) return;

    trackEvent("vin_entered", { vin: targetVin, receipt_id: receiptId });
    trackEvent("vin_decode_started", { vin: targetVin, receipt_id: receiptId });

    setIsDecoding(true);
    setError(null);
    setDecoded(null);
    setMismatches([]);
    setRecallUrl(null);

    try {
      const res = await fetch("/api/vin/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: targetVin,
          receipt_id: receiptId,
          receipt_token: receiptToken,
          year: listingYear,
          make: listingMake,
          model: listingModel,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        trackEvent("vin_decode_failed", {
          vin: targetVin,
          receipt_id: receiptId,
          error: data.error,
          status: res.status,
        });
        setError(data.error || "VIN decode failed. Please try again.");
        return;
      }

      setDecoded(data.decoded);
      setMismatches(data.mismatches || []);
      setRecallUrl(data.recall_url);

      trackEvent("vin_decode_succeeded", {
        vin: targetVin,
        receipt_id: receiptId,
        decoded_year: data.decoded.year,
        decoded_make: data.decoded.make,
        decoded_model: data.decoded.model,
        mismatch_count: data.mismatches?.length || 0,
      });

      if (data.mismatches?.length > 0) {
        trackEvent("vin_mismatch_flagged", {
          vin: targetVin,
          receipt_id: receiptId,
          mismatches: data.mismatches,
        });
      }
    } catch {
      trackEvent("vin_decode_failed", {
        vin: targetVin,
        receipt_id: receiptId,
        error: "network_error",
      });
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsDecoding(false);
    }
  };

  const vehicleDesc = decoded
    ? [decoded.year, decoded.make, decoded.model, decoded.trim].filter(Boolean).join(" ")
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">VIN Check</h3>
          {decoded && !mismatches.length && (
            <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
          )}
          {mismatches.length > 0 && (
            <AlertTriangle className="w-4 h-4 text-amber-500 ml-auto" />
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* VIN Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={vin}
            onChange={(e) => handleVinInput(e.target.value)}
            placeholder="Enter 17-character VIN"
            maxLength={17}
            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:border-blue-600 focus:ring-blue-600 uppercase"
            disabled={isDecoding}
          />
          <button
            onClick={() => handleDecode()}
            disabled={!isValid || isDecoding}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !isValid || isDecoding
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {isDecoding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : decoded ? (
              "Re-check"
            ) : (
              "Check VIN"
            )}
          </button>
        </div>

        {/* Character count */}
        {vin.length > 0 && vin.length < 17 && (
          <p className="text-xs text-gray-400">
            {vin.length}/17 characters
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Decoded Result */}
        {decoded && (
          <div className="space-y-3">
            {/* Vehicle summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Decoded as
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {vehicleDesc}
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                {decoded.engine && (
                  <div>
                    <span className="text-xs text-gray-500">Engine</span>
                    <p className="text-sm text-gray-700">{decoded.engine}</p>
                  </div>
                )}
                {decoded.drive_type && (
                  <div>
                    <span className="text-xs text-gray-500">Drive</span>
                    <p className="text-sm text-gray-700">{decoded.drive_type}</p>
                  </div>
                )}
                {decoded.fuel_type && (
                  <div>
                    <span className="text-xs text-gray-500">Fuel</span>
                    <p className="text-sm text-gray-700">{decoded.fuel_type}</p>
                  </div>
                )}
                {decoded.body_class && (
                  <div>
                    <span className="text-xs text-gray-500">Body</span>
                    <p className="text-sm text-gray-700">{decoded.body_class}</p>
                  </div>
                )}
                {decoded.plant_country && (
                  <div>
                    <span className="text-xs text-gray-500">Made in</span>
                    <p className="text-sm text-gray-700">{decoded.plant_country}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mismatches */}
            {mismatches.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">
                    {mismatches.length} mismatch{mismatches.length !== 1 ? "es" : ""} detected
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {mismatches.map((m, i) => (
                    <li key={i} className="text-sm text-amber-700">
                      <span className="font-medium">{FIELD_LABELS[m.field] || m.field}:</span>{" "}
                      Listed as <span className="font-medium">{m.listing_value}</span>,
                      VIN decodes to <span className="font-medium">{m.decoded_value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No mismatches — green confirmation */}
            {mismatches.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>VIN matches listing details</span>
              </div>
            )}

            {/* Recall link */}
            {recallUrl && (
              <a
                href={recallUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("recall_check_clicked", {
                    vin,
                    receipt_id: receiptId,
                  })
                }
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                Check for Recalls on NHTSA
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-1.5 text-xs text-gray-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            VIN decoded via NHTSA — not a title or ownership check
          </span>
        </div>
      </div>
    </div>
  );
}
