/**
 * OFFO Buyer Pass — Payment Status Hook
 *
 * Client-side hook for managing payment state on the receipt page.
 * Fetches /api/payments/status and exposes entitlement info.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type PurchaseStatus = "pending" | "paid" | "failed" | "refunded" | "none";
type PackTier = "buyer_pass" | "seller_questions";
type EntitlementLevel = "free" | "seller_pack" | "buyer_pass";

export interface UsePaymentStatusReturn {
  purchaseStatus: PurchaseStatus;
  isUnlocked: boolean;
  packTier: PackTier | null;
  compareRemaining: number;
  compareBoundTo: string | null;
  purchaseId: string | null;
  isLoading: boolean;
  paymentsEnabled: boolean;
  freeMode: boolean;
  entitlementLevel: EntitlementLevel;
  sellerPackUnlocked: boolean;
  refetch: () => Promise<void>;
}

export function usePaymentStatus(
  scenarioType: string,
  scenarioId: string | null,
  anonId: string
): UsePaymentStatusReturn {
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>("none");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [packTier, setPackTier] = useState<PackTier | null>(null);
  const [compareRemaining, setCompareRemaining] = useState(0);
  const [compareBoundTo, setCompareBoundTo] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const [entitlementLevel, setEntitlementLevel] = useState<EntitlementLevel>("free");
  const [sellerPackUnlocked, setSellerPackUnlocked] = useState(false);
  const fetchingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!scenarioId || !anonId || anonId.length < 5) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        scenario_type: scenarioType,
        scenario_id: scenarioId,
        anon_id: anonId,
      });

      const res = await fetch(`/api/payments/status?${params}`);
      if (!res.ok) return;

      const data = await res.json();

      const isFree = data.free_mode === true;
      const paymentsOn = data.payments_enabled === true;
      setPurchaseStatus(data.purchase_status || "none");
      // isUnlocked: content is accessible when free_mode=true OR when a paid purchase is confirmed
      setIsUnlocked(isFree || data.unlocked_base === true);
      setPackTier(data.pack_tier || null);
      setCompareRemaining(data.compare_remaining || 0);
      setCompareBoundTo(data.compare_bound_to || null);
      setPurchaseId(data.purchase_id || null);
      setPaymentsEnabled(paymentsOn);
      setFreeMode(isFree);
      setEntitlementLevel(isFree ? "buyer_pass" : (data.entitlement_level || "free"));
      setSellerPackUnlocked(isFree || data.seller_pack_unlocked === true);
    } catch {
      // Silently fail — payment UI just won't show
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [scenarioType, scenarioId, anonId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    purchaseStatus,
    isUnlocked,
    packTier,
    compareRemaining,
    compareBoundTo,
    purchaseId,
    isLoading,
    paymentsEnabled,
    freeMode,
    entitlementLevel,
    sellerPackUnlocked,
    refetch: fetchStatus,
  };
}
