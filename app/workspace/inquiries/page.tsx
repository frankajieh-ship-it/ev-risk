"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, Inbox, ArrowLeft, Send, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Inquiry {
  id: string;
  subject: string;
  message: string;
  inquiry_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  dealerships: { name: string; slug: string } | null;
}

interface InquiryMessage {
  id: string;
  sender_role: "buyer" | "dealer";
  message: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  open:    "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  read:    "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  replied: "bg-[#00d97e]/15 text-[#00d97e] border border-[#00d97e]/20",
  closed:  "bg-white/[0.06] text-white/40 border border-white/[0.08]",
};

const TYPE_LABELS: Record<string, string> = {
  general:     "General",
  test_drive:  "Test drive",
  price_check: "Price check",
  trade_in:    "Trade-in",
};

export default function InquiriesPage() {
  const { session } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Thread view
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    const url = filter === "all"
      ? "/api/workspace/inquiries"
      : `/api/workspace/inquiries?status=${filter}`;
    fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setInquiries(data.inquiries); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token, filter]);

  const openThread = (inq: Inquiry) => {
    setSelected(inq);
    setMessages([]);
    setReply("");
    if (!session?.access_token) return;
    setLoadingMessages(true);
    fetch(`/api/workspace/inquiries/${inq.id}/messages`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setMessages(d.messages); })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  };

  const sendReply = async () => {
    if (!reply.trim() || sending || !selected || !session?.access_token) return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspace/inquiries/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.message]);
        setReply("");
      }
    } catch { /* swallow */ }
    finally { setSending(false); }
  };

  // ── Thread detail view ─────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All inquiries
        </button>

        {/* Header */}
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-white truncate">{selected.subject}</p>
              <p className="text-sm text-white/40 mt-0.5">
                {selected.dealerships?.name ?? "Unknown dealer"}
                {" · "}
                {TYPE_LABELS[selected.inquiry_type] ?? selected.inquiry_type}
                {" · "}
                {new Date(selected.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[selected.status] ?? ""}`}>
              {selected.status}
            </span>
          </div>
          {selected.dealerships?.slug && (
            <Link
              href={`/dealers/${selected.dealerships.slug}`}
              className="inline-block text-xs text-[#00d97e] hover:text-[#00f090] mt-2 transition-colors"
            >
              View dealer profile →
            </Link>
          )}
        </div>

        {/* Message thread */}
        <div className="space-y-3">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#00d97e]" />
            </div>
          ) : (
            <>
              {/* Original message always first */}
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-[#00d97e]/[0.08] border border-[#00d97e]/15 rounded-2xl rounded-tr-sm px-4 py-3">
                  <p className="text-xs font-medium text-[#00d97e] mb-1">You</p>
                  <p className="text-sm text-white/85 leading-relaxed">{selected.message}</p>
                  <p className="text-xs text-white/30 mt-1.5">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Subsequent messages */}
              {messages
                .filter((m) => !(m.sender_role === "buyer" && m.message === selected.message))
                .map((msg) => {
                  const isBuyer = msg.sender_role === "buyer";
                  return (
                    <div key={msg.id} className={`flex ${isBuyer ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        isBuyer
                          ? "bg-[#00d97e]/[0.08] border border-[#00d97e]/15 rounded-tr-sm"
                          : "bg-[#161b22] border border-white/[0.08] rounded-tl-sm"
                      }`}>
                        <p className={`text-xs font-medium mb-1 ${isBuyer ? "text-[#00d97e]" : "text-white/50"}`}>
                          {isBuyer ? "You" : selected.dealerships?.name ?? "Dealer"}
                        </p>
                        <p className="text-sm text-white/85 leading-relaxed">{msg.message}</p>
                        <p className="text-xs text-white/30 mt-1.5">{new Date(msg.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}

              {messages.length === 0 && selected.status === "open" && (
                <p className="text-center text-sm text-white/30 py-4">Waiting for dealer reply…</p>
              )}
            </>
          )}
        </div>

        {/* Reply box */}
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply(); }}
            placeholder="Add a follow-up message…"
            rows={3}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#00d97e]/40 resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-white/25">⌘↵ to send</p>
            <button
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] hover:bg-[#00c970] disabled:opacity-40 text-[#0d1117] text-sm font-semibold rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Inquiries</h1>
        <p className="text-sm text-white/40 mt-0.5">Messages you&apos;ve sent to dealers</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "open", "replied", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === s
                ? "bg-[#00d97e]/15 text-[#00d97e]"
                : "bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-12 text-center">
          <Inbox className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/60 font-medium">No inquiries yet</p>
          <p className="text-sm text-white/35 mt-1">
            Browse the{" "}
            <Link href="/dealers" className="text-[#00d97e] hover:text-[#00f090] transition-colors">
              dealer directory
            </Link>{" "}
            to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {inquiries.map((inq) => (
            <button
              key={inq.id}
              onClick={() => openThread(inq)}
              className="w-full text-left bg-[#161b22] border border-white/[0.08] hover:border-white/[0.15] rounded-xl p-4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-white/30 shrink-0" />
                    <p className="font-medium text-white/90 truncate text-sm">{inq.subject}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_STYLES[inq.status] ?? ""}`}>
                      {inq.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/40 truncate pl-6">{inq.message}</p>
                  <p className="text-xs text-white/25 mt-1 pl-6">
                    {inq.dealerships?.name ?? "Unknown dealer"} · {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
