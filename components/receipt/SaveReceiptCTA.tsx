"use client";

/**
 * SaveReceiptCTA — "Save This Receipt" button on receipt results
 *
 * Anonymous users: saves to localStorage (instant, no login required).
 * Authenticated users: saves to server via /api/user/scenario/save.
 */

import { useState, useEffect, useCallback } from "react";
import { Bookmark, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import { addToAnonGarage } from "@/lib/anon-garage";
import type { ListingReceipt } from "@/types/receipt";

interface SaveReceiptCTAProps {
  receipt: ListingReceipt;
  onSaveSuccess?: () => void;
  compact?: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const LOCAL_STORAGE_KEY = "offo_saved_receipts";

interface LocalSavedReceipt {
  receipt_id: string;
  vehicle: string;
  verdict: string;
  verdict_reason: string | null;
  price: number | null;
  mileage: number | null;
  saved_at: string;
}

function saveToLocalStorage(receipt: ListingReceipt): boolean {
  try {
    const existing: LocalSavedReceipt[] = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
    );
    // Deduplicate by receipt_id
    if (existing.some((r) => r.receipt_id === receipt.receipt_id)) {
      return true; // Already saved
    }
    const summary = receipt.listing_summary;
    existing.push({
      receipt_id: receipt.receipt_id,
      vehicle: [summary?.year, summary?.make, summary?.model, summary?.trim]
        .filter(Boolean)
        .join(" "),
      verdict: receipt.verdict,
      verdict_reason: receipt.verdict_reason || null,
      price: summary?.price || null,
      mileage: summary?.mileage || null,
      saved_at: new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

export default function SaveReceiptCTA({
  receipt,
  onSaveSuccess,
  compact = false,
}: SaveReceiptCTAProps) {
  const { isAuthenticated, session } = useAuth();
  const { trackEvent } = useEventTracking();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const summary = receipt.listing_summary;
  const vehicle = [summary?.year, summary?.make, summary?.model, summary?.trim]
    .filter(Boolean)
    .join(" ");
  const scenarioHash = `receipt_${receipt.receipt_id}`;

  // Check if already saved (localStorage)
  useEffect(() => {
    try {
      const existing: LocalSavedReceipt[] = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
      );
      if (existing.some((r) => r.receipt_id === receipt.receipt_id)) {
        setSaveState("saved");
      }
    } catch {
      // ignore
    }
  }, [receipt.receipt_id]);

  const doServerSave = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch("/api/user/scenario/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scenario_type: "receipt",
          receipt_id: receipt.receipt_id,
          scenario_hash: scenarioHash,
          vehicle_model: vehicle || "Unknown Vehicle",
          vehicle_year: summary?.year || 0,
          fit_signal: receipt.verdict,
          one_sentence_verdict: receipt.verdict_reason || null,
          title: vehicle ? `${vehicle} — ${receipt.verdict}` : null,
          inputs: {
            price: summary?.price,
            mileage: summary?.mileage,
            seller_type: summary?.seller_type,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        console.warn("[SaveReceipt] Server save failed:", data.error);
      }
    } catch (err) {
      console.warn("[SaveReceipt] Server save error:", err instanceof Error ? err.message : err);
    }
  }, [session, receipt, scenarioHash, vehicle, summary]);

  const handleClick = () => {
    trackEvent("scenario_save_clicked", {
      receipt_id: receipt.receipt_id,
      is_authenticated: isAuthenticated,
    });

    setSaveState("saving");
    setError(null);

    // Always save to localStorage first (works for everyone)
    const localSuccess = saveToLocalStorage(receipt);

    if (!localSuccess) {
      trackEvent("scenario_save_failed", {
        receipt_id: receipt.receipt_id,
        error: "localStorage unavailable",
      });
      setSaveState("error");
      setError("Could not save — browser storage unavailable");
      return;
    }

    // Mirror into anon garage so the nav Garage badge count stays in sync
    if (!isAuthenticated) {
      addToAnonGarage({
        type: "receipt",
        label: vehicle || "Unknown Vehicle",
        data: {
          receipt_id: receipt.receipt_id,
          verdict: receipt.verdict,
          verdict_reason: receipt.verdict_reason || null,
          price: summary?.price || null,
          mileage: summary?.mileage || null,
        },
      });
    }

    // Also save to server if authenticated (fire-and-forget)
    if (isAuthenticated && session?.access_token) {
      doServerSave();
    }

    trackEvent("scenario_save_success", {
      receipt_id: receipt.receipt_id,
      is_new: true,
      storage: isAuthenticated ? "server+local" : "local",
    });

    setSaveState("saved");
    onSaveSuccess?.();
  };

  const fullClass = "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 transition-all shadow-sm";
  const compactClass = "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors";

  return (
    <>
      {saveState === "idle" && (
        <button
          onClick={handleClick}
          className={compact ? compactClass : fullClass}
        >
          <Bookmark className="w-4 h-4" />
          {compact ? "Save" : "Save to My Garage"}
        </button>
      )}

      {saveState === "saving" && (
        <div className={compact
          ? "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500"
          : "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-500"
        }>
          <Loader2 className="w-4 h-4 animate-spin" />
          {!compact && "Saving..."}
        </div>
      )}

      {saveState === "saved" && (
        <div className={compact
          ? "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-green-200 text-green-700 bg-green-50"
          : "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 border-green-200 text-green-700 bg-green-50"
        }>
          <CheckCircle className="w-4 h-4" />
          {compact ? "Saved" : "Receipt Saved!"}
        </div>
      )}

      {saveState === "error" && (
        <div className={compact ? "" : "w-full"}>
          <div className={compact
            ? "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-700 bg-red-50"
            : "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-red-200 text-red-700 bg-red-50"
          }>
            <AlertCircle className="w-4 h-4" />
            {compact ? "Error" : (error || "Failed to save")}
          </div>
          <button
            onClick={() => {
              setSaveState("idle");
              setError(null);
            }}
            className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 underline"
          >
            Try again
          </button>
        </div>
      )}
    </>
  );
}
