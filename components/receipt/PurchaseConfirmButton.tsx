"use client";

/**
 * "I bought this car" CTA shown on the receipt when:
 * - The user is authenticated
 * - Verdict is GREEN or YELLOW
 * - Not already marked as purchased
 *
 * On mount, looks up the garage vehicle linked to this receipt_id.
 * If found and not yet purchased, shows the confirm button.
 * On click: calls POST /api/workspace/garage/{vehicleId}/confirm-purchase,
 * then navigates to the owned-ev page with ?just_purchased=true.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

interface PurchaseConfirmButtonProps {
  receiptId: string;
  authToken: string;
  verdict: string;
  vin?: string | null;
}

export function PurchaseConfirmButton({ receiptId, authToken, verdict, vin }: PurchaseConfirmButtonProps) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for GREEN or YELLOW verdicts
  const isEligibleVerdict = verdict === "GREEN" || verdict === "YELLOW";

  useEffect(() => {
    if (!authToken || !receiptId || !isEligibleVerdict) return;

    // Look for a garage vehicle linked to this receipt
    fetch("/api/workspace/garage", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((d: { success: boolean; vehicles?: { id: string; receipt_id?: string | null; vin?: string | null; purchased_at?: string | null }[] }) => {
        if (!d.success || !d.vehicles) return;
        // Match by receipt_id first, then fall back to VIN
        const match =
          d.vehicles.find((v) => v.receipt_id === receiptId) ??
          (vin ? d.vehicles.find((v) => v.vin && v.vin.toUpperCase() === vin.toUpperCase()) : undefined);
        if (match) {
          setVehicleId(match.id);
          if (match.purchased_at) setAlreadyPurchased(true);
        }
      })
      .catch(() => {});
  }, [receiptId, authToken, isEligibleVerdict, vin]);

  if (!isEligibleVerdict || !vehicleId || alreadyPurchased) return null;

  if (confirmed) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 rounded-lg border border-[#00d97e]/30 bg-[#00d97e]/10 text-[#00d97e]">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-semibold">Purchase confirmed — opening your report</span>
      </div>
    );
  }

  async function handleClick() {
    if (loading || !vehicleId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspace/garage/${vehicleId}/confirm-purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setConfirmed(true);
      router.push(`/workspace/garage/${vehicleId}/owned-ev?just_purchased=true`);
    } catch {
      setError("Failed to confirm purchase");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-[#00d97e]/40 bg-[#00d97e]/[0.08] text-[#00d97e] hover:bg-[#00d97e]/[0.14] hover:border-[#00d97e]/60 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        I bought this car →
      </button>
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
}
