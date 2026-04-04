"use client";

/**
 * OFfoChat — Collapsible AI Assistant
 *
 * Free tier: 5 messages/day (single model, basic)
 * Paid (OFFO AI Unlimited $9.99): unlimited, full multi-model pipeline
 *
 * Appears 8 seconds after result load as a bottom-right FAB.
 * Expands to a 380px sidebar (desktop) or 80vh bottom sheet (mobile).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronDown, Lock, Sparkles, CheckCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatContext {
  vehicle?: string;
  price?: number;
  mileage?: number;
  vin?: string;
  top_concerns?: string[];
  comparison_label_a?: string;
  comparison_label_b?: string;
  winner_signal?: string;
  // Auction-specific
  lot_number?: string;
  title_status?: string;
  primary_damage?: string;
  secondary_damage?: string;
  salvage_score?: number;
  salvage_grade?: string;
  arv?: number;
  max_safe_bid?: number;
  repair_cost_low?: number;
  repair_cost_high?: number;
  auction_source?: string;
  run_and_drive?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  fallback?: boolean;
}

interface OFfoChatProps {
  scenarioType: "receipt" | "compare" | "auction";
  scenarioId: string;
  sessionId: string;
  context: ChatContext;
  isMobile?: boolean;
  paymentsEnabled?: boolean;
  freeMode?: boolean;
  trackEvent?: (name: string, data?: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Quick questions per scenario type
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS: Record<"receipt" | "compare" | "auction", string[]> = {
  receipt: [
    "Is this price fair?",
    "What should I watch out for?",
    "Help me negotiate",
  ],
  compare: [
    "Which is the better buy?",
    "What's the key difference I should care about?",
    "Which fits a typical commute better?",
  ],
  auction: [
    "Is this worth bidding on?",
    "What will this cost to repair?",
    "What does a salvage title mean for insurance?",
  ],
};

const FREE_DAILY_LIMIT = 5;

// ---------------------------------------------------------------------------
// Paywall Card
// ---------------------------------------------------------------------------

function PaywallCard({
  onUnlock,
  loading,
}: {
  onUnlock: () => void;
  loading: boolean;
}) {
  return (
    <div className="mx-1 my-2 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-center">
      <div className="flex justify-center mb-2">
        <div className="bg-blue-100 rounded-full p-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <p className="font-semibold text-gray-900 text-sm mb-0.5">Unlock OFFO AI Unlimited</p>
      <p className="text-xs text-gray-500 mb-3">
        You&apos;ve used your {FREE_DAILY_LIMIT} free messages today.
      </p>
      <ul className="text-xs text-gray-600 space-y-1 mb-4 text-left">
        {[
          "Unlimited questions, forever",
          "Full multi-model reasoning",
          "Saved history across devices",
        ].map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>
      <button
        onClick={onUnlock}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? "Preparing checkout…" : "Unlock for $9.99 — one time"}
      </button>
      <p className="text-xs text-gray-400 mt-1.5">No subscriptions. Ever.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nudge Banner (shown after 3 messages, before limit)
// ---------------------------------------------------------------------------

function NudgeBanner({ onUnlock, onDismiss, loading }: { onUnlock: () => void; onDismiss: () => void; loading: boolean }) {
  return (
    <div className="mx-1 mb-1 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex items-center gap-2 text-xs">
      <Lock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      <span className="text-gray-600 flex-1">Getting value? Unlock unlimited for $9.99 →</span>
      <button onClick={onUnlock} disabled={loading} className="text-blue-600 font-medium hover:underline">
        {loading ? "…" : "Unlock"}
      </button>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 ml-1">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OFfoChat({
  scenarioType,
  scenarioId,
  sessionId,
  context,
  isMobile = false,
  paymentsEnabled = true,
  freeMode = false,
  trackEvent,
}: OFfoChatProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Paywall / unlock state
  const [chatUnlocked, setChatUnlocked] = useState(freeMode);
  const [checkingUnlock, setCheckingUnlock] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [messagesUsedToday, setMessagesUsedToday] = useState(0);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Tooltip
  const [tooltipShown, setTooltipShown] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---------------------------------------------------------------------------
  // Check unlock status on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (freeMode) { setChatUnlocked(true); return; }
    if (!sessionId) return;

    setCheckingUnlock(true);
    fetch(`/api/payments/status?scenario_type=chat&scenario_id=${encodeURIComponent(sessionId)}&anon_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.chat_unlocked || data.free_mode) setChatUnlocked(true);
      })
      .catch(() => {})
      .finally(() => setCheckingUnlock(false));
  }, [sessionId, freeMode]);

  // Check for ?chat_pass=1&checkout=success return from Stripe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat_pass") === "1" && params.get("checkout") === "success") {
      setChatUnlocked(true);
      setJustUnlocked(true);
      setIsVisible(true);
      setIsOpen(true);
      setTimeout(() => setJustUnlocked(false), 5_000);
    }
  }, []);

  // Show FAB after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      const seen = typeof window !== "undefined"
        ? localStorage.getItem("offo_chat_tooltip_seen") === "1"
        : true;
      if (!seen) {
        setTooltipShown(true);
        setTimeout(() => {
          setTooltipShown(false);
          setTooltipDismissed(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("offo_chat_tooltip_seen", "1");
          }
        }, 3_500);
      } else {
        setTooltipDismissed(true);
      }
    }, 8_000);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, limitReached]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMobile) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, isMobile]);

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  const handleCheckout = useCallback(async () => {
    if (checkoutLoading) return;
    trackEvent?.("chat_unlock_clicked", { scenario_type: scenarioType, session_id: sessionId });
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: "chat",
          scenario_id: sessionId,
          anon_id: sessionId,
          pack_tier: "chat_pass",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setCheckoutLoading(false);
    }
  }, [checkoutLoading, sessionId]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || limitReached) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            scenario_type: scenarioType,
            scenario_id: scenarioId,
            message: trimmed,
            context,
          }),
        });

        if (res.status === 402) {
          // Free tier exhausted
          setLimitReached(true);
          setMessagesUsedToday(FREE_DAILY_LIMIT);
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          trackEvent?.("chat_limit_reached", { scenario_type: scenarioType, session_id: sessionId });
          return;
        }

        if (res.status === 429) {
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          const data = await res.json().catch(() => ({}));
          const retryAfter = data.retry_after ?? 60;
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: `You've reached the message limit. Try again in ${retryAfter}s.`, fallback: true },
          ]);
          return;
        }

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply || "Something went wrong. Please try again.", fallback: data.fallback },
        ]);

        // Track message count for nudge
        const newCount = messagesUsedToday + 1;
        setMessagesUsedToday(newCount);
        trackEvent?.("chat_message_sent", { scenario_type: scenarioType, messages_used: newCount, is_paid: chatUnlocked });
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: "I'm having trouble connecting. Please try again.", fallback: true },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, limitReached, sessionId, scenarioType, scenarioId, context, messagesUsedToday]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showQuickQuestions = messages.length === 0 && !limitReached;
  const showNudge = !chatUnlocked && !nudgeDismissed && !limitReached && messagesUsedToday >= 3 && paymentsEnabled;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isVisible) return null;

  const panelClasses = isMobile
    ? "fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 flex flex-col"
    : "fixed bottom-20 right-4 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col";

  const panelStyle = isMobile ? { height: "80vh" } : {};

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {tooltipShown && !tooltipDismissed && (
            <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              ✨ New: Ask OFFO
            </div>
          )}
          <button
            onClick={() => {
              setIsOpen(true);
              setTooltipShown(false);
              if (typeof window !== "undefined") localStorage.setItem("offo_chat_tooltip_seen", "1");
              trackEvent?.("chat_session_opened", { scenario_type: scenarioType });
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
            aria-label="Ask OFFO"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Ask OFFO</span>
            {!chatUnlocked && !checkingUnlock && paymentsEnabled && !freeMode && (
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">Free</span>
            )}
          </button>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <>
          {isMobile && (
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setIsOpen(false)} />
          )}
          <div className={panelClasses} style={panelStyle}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Ask OFFO</span>
                {chatUnlocked && !freeMode ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Unlimited</span>
                ) : (
                  !freeMode && paymentsEnabled && <span className="text-xs text-gray-400">{Math.max(0, FREE_DAILY_LIMIT - messagesUsedToday)} free left today</span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
                aria-label="Close chat"
              >
                {isMobile ? <ChevronDown className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </div>

            {/* Just-unlocked banner */}
            {justUnlocked && (
              <div className="bg-green-50 border-b border-green-100 px-4 py-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800 font-medium">Welcome to OFFO AI Unlimited! 🎉</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {/* Welcome / quick questions */}
              {showQuickQuestions && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 text-center pt-2">
                    Ask me anything about{" "}
                    {scenarioType === "receipt"
                      ? context.vehicle ?? "this vehicle"
                      : scenarioType === "auction"
                      ? context.vehicle ?? "this auction lot"
                      : `${context.comparison_label_a ?? "Option A"} vs ${context.comparison_label_b ?? "Option B"}`}
                  </p>
                  <div className="flex flex-col gap-2">
                    {QUICK_QUESTIONS[scenarioType].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors border border-blue-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : msg.fallback
                        ? "bg-gray-100 text-gray-500 rounded-bl-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}

              {/* Paywall card — shown when free limit hit */}
              {limitReached && paymentsEnabled && !freeMode && (
                <PaywallCard onUnlock={handleCheckout} loading={checkoutLoading} />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Nudge banner */}
            {showNudge && (
              <NudgeBanner
                onUnlock={handleCheckout}
                onDismiss={() => setNudgeDismissed(true)}
                loading={checkoutLoading}
              />
            )}

            {/* Input — disabled when limit reached and not unlocked */}
            {(!limitReached || chatUnlocked) && (
              <div className="border-t border-gray-100 px-3 py-3 flex gap-2 items-end flex-shrink-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this vehicle…"
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none text-sm rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 min-h-[38px] max-h-[100px] overflow-y-auto"
                  style={{ lineHeight: "1.4" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
