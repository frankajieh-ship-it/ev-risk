"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { ListingReceipt } from "@/types/receipt";

const SaveReceiptCTA = dynamic(() => import("@/components/receipt/SaveReceiptCTA"), { ssr: false });

interface PostReceiptPopupProps {
  show: boolean;
  receipt: ListingReceipt | null;
  onClose: () => void;
  onSaveSuccess: () => void;
  onCompare: () => void;
}

export default function PostReceiptPopup({
  show,
  receipt,
  onClose,
  onSaveSuccess,
  onCompare,
}: PostReceiptPopupProps) {
  return (
    <AnimatePresence>
      {show && receipt && (
        <>
          <motion.div
            key="popup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />
          <motion.div
            key="popup-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#161b22] border border-white/[0.08] rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 max-w-lg mx-auto"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            <h3 className="text-base font-bold text-white mb-1">
              Save to My Garage
            </h3>
            <p className="text-sm text-white/50 mb-5">
              Get recall alerts, AI insights, and easy comparisons — all in one place.
            </p>

            <div className="mb-3" data-tutorial="save-garage">
              <SaveReceiptCTA receipt={receipt} onSaveSuccess={onSaveSuccess} />
            </div>

            <button
              onClick={() => {
                onClose();
                onCompare();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/[0.12] text-sm font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition-all"
            >
              Compare with another listing
            </button>

            <button
              onClick={onClose}
              className="w-full mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Not now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
