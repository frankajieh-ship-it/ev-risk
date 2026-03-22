"use client";

/**
 * OFfoChat — Collapsible AI Assistant
 *
 * Appears 8 seconds after result load as a bottom-right FAB.
 * Expands to a 380px sidebar (desktop) or 80vh bottom sheet (mobile).
 * Powered by POST /api/chat — 4-stage multi-model pipeline.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronDown } from "lucide-react";

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
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  fallback?: boolean;
}

interface OFfoChatProps {
  scenarioType: "receipt" | "compare";
  scenarioId: string;
  sessionId: string;
  context: ChatContext;
  isMobile?: boolean;
}

// ---------------------------------------------------------------------------
// Quick questions per scenario type
// ---------------------------------------------------------------------------

const QUICK_QUESTIONS: Record<"receipt" | "compare", string[]> = {
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OFfoChat({
  scenarioType,
  scenarioId,
  sessionId,
  context,
  isMobile = false,
}: OFfoChatProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [tooltipShown, setTooltipShown] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Show FAB after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      // One-time tooltip
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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMobile]);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setRateLimitMsg(null);

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
            is_mobile: isMobile,
          }),
        });

        if (res.status === 429) {
          const data = await res.json().catch(() => ({}));
          const retryAfter = data.retry_after ?? 60;
          setRateLimitMsg(
            `You've reached the message limit. Try again in ${retryAfter}s.`
          );
          // Remove the user message we just added
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          return;
        }

        const data = await res.json();
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "Something went wrong. Please try again.",
          fallback: data.fallback,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I'm having trouble connecting. Please try again.",
          fallback: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, scenarioType, scenarioId, context, isMobile]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showQuickQuestions = messages.length === 0;
  const quickQuestions = QUICK_QUESTIONS[scenarioType];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isVisible) return null;

  // Desktop panel width; mobile uses bottom sheet
  const panelClasses = isMobile
    ? "fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 flex flex-col"
    : "fixed bottom-20 right-4 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col";

  const panelStyle = isMobile
    ? { height: "80vh" }
    : {};

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {/* Tooltip */}
          {tooltipShown && !tooltipDismissed && (
            <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-fade-in">
              ✨ New: Ask OFFO
              <div className="absolute bottom-0 right-4 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
            </div>
          )}
          <button
            onClick={() => {
              setIsOpen(true);
              setTooltipShown(false);
              if (typeof window !== "undefined") {
                localStorage.setItem("offo_chat_tooltip_seen", "1");
              }
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
            aria-label="Ask OFFO"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Ask OFFO</span>
          </button>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          {isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setIsOpen(false)}
            />
          )}

          <div className={panelClasses} style={panelStyle}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Ask OFFO</span>
                <span className="text-xs text-gray-400 font-normal">AI assistant</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
                aria-label="Close chat"
              >
                {isMobile ? <ChevronDown className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {/* Welcome state */}
              {showQuickQuestions && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 text-center pt-2">
                    Ask me anything about{" "}
                    {scenarioType === "receipt"
                      ? context.vehicle ?? "this vehicle"
                      : `${context.comparison_label_a ?? "Option A"} vs ${context.comparison_label_b ?? "Option B"}`}
                  </p>
                  <div className="flex flex-col gap-2">
                    {quickQuestions.map((q) => (
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
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
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

              {/* Rate limit message */}
              {rateLimitMsg && (
                <p className="text-xs text-red-500 text-center py-1">{rateLimitMsg}</p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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
          </div>
        </>
      )}
    </>
  );
}
