"use client";

import { useState } from "react";
import { X, Send, CheckCircle } from "lucide-react";

interface DealerInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_verified: boolean;
}

interface DealerInquiryModalProps {
  dealerInfo: DealerInfo;
  vehicleLabel: string;
  isAuthenticated: boolean;
  accessToken: string | null;
  onClose: () => void;
  receiptId?: string | null;
}

export default function DealerInquiryModal({
  dealerInfo,
  vehicleLabel,
  isAuthenticated,
  accessToken,
  onClose,
  receiptId,
}: DealerInquiryModalProps) {
  const [message, setMessage] = useState("");
  const [inquiryType, setInquiryType] = useState<"general" | "test_drive" | "price_check" | "trade_in">("general");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    if (!isAuthenticated || !accessToken) {
      setError("Please sign in to contact this dealer.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          dealership_id: dealerInfo.id,
          subject: vehicleLabel,
          message: message.trim(),
          inquiry_type: inquiryType,
          receipt_id: receiptId || null,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#161b22] rounded-2xl border border-white/[0.10] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div>
            <p className="text-sm font-semibold text-white">Contact {dealerInfo.name}</p>
            <p className="text-xs text-white/40 mt-0.5">{vehicleLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {sent ? (
            <div className="text-center py-6">
              <CheckCircle className="w-10 h-10 text-[#00d97e] mx-auto mb-3" />
              <p className="text-sm font-semibold text-white mb-1">Inquiry sent!</p>
              <p className="text-xs text-white/50">The dealer will respond to your OFFO account.</p>
              <button onClick={onClose} className="mt-4 text-xs text-white/40 hover:text-white/70">Close</button>
            </div>
          ) : (
            <>
              {!isAuthenticated && (
                <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/20 px-3 py-2">
                  <p className="text-xs text-amber-400">
                    <a href="/auth/login" className="underline font-medium">Sign in</a> to contact dealers and track your inquiries.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Inquiry type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["general", "General inquiry"],
                    ["test_drive", "Test drive"],
                    ["price_check", "Price check"],
                    ["trade_in", "Trade-in"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setInquiryType(val)}
                      className={`text-xs py-2 px-3 rounded-lg border transition-colors ${
                        inquiryType === val
                          ? "border-[#00d97e]/40 bg-[#00d97e]/[0.08] text-white"
                          : "border-white/[0.08] text-white/50 hover:text-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi, I'm interested in the ${vehicleLabel}. Is it still available?`}
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#00d97e]/40 resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting || !isAuthenticated}
                className="w-full flex items-center justify-center gap-2 bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-40 text-[#0d1117] text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Sending…" : "Send inquiry"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
