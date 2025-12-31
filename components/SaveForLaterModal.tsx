"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Send } from "lucide-react";

interface SaveForLaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportUrl: string;
  vehicle: string;
}

export default function SaveForLaterModal({
  isOpen,
  onClose,
  reportUrl,
  vehicle,
}: SaveForLaterModalProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address");
      return;
    }

    setSending(true);

    try {
      // Send email with report link
      const response = await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          reportUrl,
          vehicle,
        }),
      });

      if (response.ok) {
        setSent(true);
        setTimeout(() => {
          onClose();
          setSent(false);
          setEmail("");
        }, 2000);
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Save for later error:", error);
      alert("Failed to send email. Please try again or copy the link manually.");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reportUrl);
    alert("Report link copied to clipboard!");
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
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={onClose}
                  disabled={sending}
                  className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Save for Later</h3>
                      <p className="text-blue-100 text-sm">{vehicle}</p>
                    </div>
                  </div>
                </div>

                {sent ? (
                  /* Success State */
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Email Sent!</h4>
                    <p className="text-gray-600 text-sm">
                      Check your inbox for the report link.
                    </p>
                  </div>
                ) : (
                  /* Form */
                  <div className="p-6">
                    <p className="text-gray-700 mb-4">
                      Enter your email to receive a link to this report. We won't spam you or share your email.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          disabled={sending}
                          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sending || !email.trim()}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {sending ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Send Me the Link
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleCopyLink}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Or just copy the link →
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Your report will remain accessible at this link. No account required.
                    </p>
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
