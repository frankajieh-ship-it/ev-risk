"use client";

/**
 * SaveReceiptCTA — "Save This Receipt" button on receipt results
 *
 * Triggers login modal if not authenticated, then saves the receipt
 * to saved_scenarios with scenario_type="receipt".
 */

import { useState, useEffect, useCallback } from "react";
import { Bookmark, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import LoginModal from "@/components/LoginModal";
import type { ListingReceipt } from "@/types/receipt";

interface SaveReceiptCTAProps {
  receipt: ListingReceipt;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const PENDING_SAVE_KEY = "offo_pending_receipt_save";
const ACTIVE_RECEIPT_KEY = "offo_active_receipt_id";

export default function SaveReceiptCTA({
  receipt,
}: SaveReceiptCTAProps) {
  const { isAuthenticated, session, isConfigured, isReady } = useAuth();
  const { trackEvent } = useEventTracking();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const summary = receipt.listing_summary;
  const vehicle = [summary?.year, summary?.make, summary?.model, summary?.trim]
    .filter(Boolean)
    .join(" ");
  const scenarioHash = `receipt_${receipt.receipt_id}`;

  const doSave = useCallback(async () => {
    if (!session?.access_token || !isReady) return;

    setSaveState("saving");
    setError(null);

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
        throw new Error(data.error || "Failed to save");
      }

      trackEvent("save_receipt_succeeded", {
        receipt_id: receipt.receipt_id,
        scenario_id: data.scenario_id,
        is_new: data.is_new,
      });

      setSaveState("saved");
    } catch (err) {
      console.error("Save receipt error:", err);
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [session, isReady, receipt, scenarioHash, vehicle, summary, trackEvent]);

  // Auto-save after login if there's a pending save
  useEffect(() => {
    if (!isAuthenticated || !isReady) return;
    try {
      const pending = localStorage.getItem(PENDING_SAVE_KEY);
      if (pending === receipt.receipt_id) {
        localStorage.removeItem(PENDING_SAVE_KEY);
        doSave();
      }
    } catch {
      // localStorage unavailable
    }
  }, [isAuthenticated, isReady, receipt.receipt_id, doSave]);

  const handleClick = () => {
    trackEvent("save_receipt_clicked", {
      receipt_id: receipt.receipt_id,
      is_authenticated: isAuthenticated,
    });

    if (!isAuthenticated || !session?.access_token) {
      // Store pending save + active receipt for after login redirect
      try {
        localStorage.setItem(PENDING_SAVE_KEY, receipt.receipt_id);
        localStorage.setItem(ACTIVE_RECEIPT_KEY, receipt.receipt_id);
      } catch {
        // localStorage unavailable
      }
      setShowLoginModal(true);
      return;
    }

    doSave();
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    // Auto-save will trigger via the useEffect above
  };

  if (!isConfigured) return null;

  return (
    <>
      {saveState === "idle" && (
        <button
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
        >
          <Bookmark className="w-4 h-4" />
          {isAuthenticated ? "Save This Receipt" : "Sign in to Save"}
        </button>
      )}

      {saveState === "saving" && (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </div>
      )}

      {saveState === "saved" && (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-green-200 text-green-700 bg-green-50">
          <CheckCircle className="w-4 h-4" />
          Receipt Saved!
        </div>
      )}

      {saveState === "error" && (
        <div className="w-full">
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-red-200 text-red-700 bg-red-50">
            <AlertCircle className="w-4 h-4" />
            {error || "Failed to save"}
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

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        redirectPath={
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : undefined
        }
      />
    </>
  );
}
