"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bookmark, Check, MonitorSmartphone } from "lucide-react";
import { addToAnonGarage } from "@/lib/anon-garage";

interface SaveForLaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportUrl: string;
  vehicle: string;
  /** Raw data to persist (routine result, score, etc.) */
  data?: Record<string, unknown>;
  /** Called when login modal should open for sync */
  onOpenLogin?: () => void;
}

export default function SaveForLaterModal({
  isOpen,
  onClose,
  reportUrl,
  vehicle,
  data,
  onOpenLogin,
}: SaveForLaterModalProps) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    addToAnonGarage({
      type: "fit_profile",
      label: vehicle,
      data: {
        ...(data ?? {}),
        reportUrl,
        vehicle,
      },
    });
    setSaved(true);
    setTimeout(() => {
      onClose();
      setSaved(false);
    }, 1800);
  };

  const handleSyncClick = () => {
    onClose();
    onOpenLogin?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-teal-600 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Bookmark className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Save to Garage</h3>
                      <p className="text-blue-100 text-sm truncate max-w-[200px]">{vehicle}</p>
                    </div>
                  </div>
                </div>

                {saved ? (
                  /* Success state */
                  <div className="p-8 text-center">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-7 h-7 text-green-600" />
                    </div>
                    <h4 className="text-base font-bold text-gray-900 mb-1">Saved to your garage</h4>
                    <p className="text-gray-500 text-sm">
                      View it any time at{" "}
                      <a href="/shortlist" className="text-blue-600 hover:underline">
                        /shortlist
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    <p className="text-gray-700 text-sm">
                      Saved instantly — no account needed. Your garage stays on this device.
                    </p>

                    <button
                      onClick={handleSave}
                      className="w-full px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Bookmark className="w-4 h-4" />
                      Save to my garage
                    </button>

                    <div className="pt-3 border-t border-gray-100">
                      <button
                        onClick={handleSyncClick}
                        className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors py-1"
                      >
                        <MonitorSmartphone className="w-4 h-4" />
                        Sync across devices →
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-1">
                        Sign in to access your garage on any device
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
