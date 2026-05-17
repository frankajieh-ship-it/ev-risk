/**
 * Dealer Inquiries Page
 *
 * View received buyer inquiries, filter by status, reply.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Loader2, Send, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Inquiry {
  id: string;
  subject: string;
  message: string;
  inquiry_type: string;
  status: string;
  created_at: string;
  buyer_email?: string;
  inventory_item?: {
    make: string;
    model: string;
    year: number | null;
  } | null;
}

interface Message {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export default function DealerInquiriesPage() {
  const { session } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Detail view
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
  }), [session?.access_token]);

  const loadInquiries = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/dealer/inquiries${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.inquiries || []);
      }
    } catch (err) {
      console.error("Failed to load inquiries:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, filter, authHeaders]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  const openInquiry = async (inq: Inquiry) => {
    setSelected(inq);
    setLoadingMessages(true);
    setReply("");

    try {
      const res = await fetch(`/api/dealer/inquiries/${inq.id}/messages`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }

      // Mark as read if open
      if (inq.status === "open") {
        await fetch(`/api/dealer/inquiries/${inq.id}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: "read" }),
        });
        setInquiries((prev) =>
          prev.map((i) => (i.id === inq.id ? { ...i, status: "read" } : i))
        );
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);

    try {
      const res = await fetch(`/api/dealer/inquiries/${selected.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: reply.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setReply("");

        // Update status to replied
        setInquiries((prev) =>
          prev.map((i) => (i.id === selected.id ? { ...i, status: "replied" } : i))
        );
      }
    } catch (err) {
      console.error("Failed to send reply:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  // Detail view
  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Inquiries
        </button>

        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] p-5 mb-4">
          <h2 className="font-semibold text-white">{selected.subject}</h2>
          <p className="text-xs text-white/40 mt-1">
            {selected.inquiry_type} &middot; {new Date(selected.created_at).toLocaleDateString()}
            {selected.buyer_email && ` &middot; ${selected.buyer_email}`}
          </p>
          {selected.inventory_item && (
            <p className="text-xs text-white/40 mt-1">
              Vehicle: {selected.inventory_item.year} {selected.inventory_item.make} {selected.inventory_item.model}
            </p>
          )}
          <p className="text-sm text-white/70 mt-3">{selected.message}</p>
        </div>

        {/* Messages thread */}
        <div className="bg-white/[0.05] rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.08]">
            <h3 className="text-sm font-medium text-white/70">Conversation</h3>
          </div>

          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-white/30">
              No replies yet. Send the first response below.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`px-5 py-3 ${msg.sender_role === "dealer" ? "bg-[#00d97e]/[0.04]" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${msg.sender_role === "dealer" ? "text-[#00d97e]" : "text-blue-400"}`}>
                      {msg.sender_role === "dealer" ? "You" : "Buyer"}
                    </span>
                    <span className="text-xs text-white/30">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-white/70">{msg.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          <div className="px-5 py-3 border-t border-white/[0.08] flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
              placeholder="Type your reply..."
              className="flex-1 px-3 py-2 bg-white/[0.06] border border-white/[0.10] rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/50"
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-lg text-sm font-semibold hover:bg-[#00f090] disabled:opacity-40 flex items-center gap-1 transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  const filters = ["all", "open", "read", "replied", "closed"];
  const filtered = filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter);

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Inquiries</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-[#00d97e]/15 text-[#00d97e]"
                : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-12 text-center">
          <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No inquiries found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inq) => (
            <button
              key={inq.id}
              onClick={() => openInquiry(inq)}
              className="w-full bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 text-left hover:bg-white/[0.07] hover:border-white/[0.14] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{inq.subject}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {inq.inquiry_type} &middot; {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-white/50 mt-1 line-clamp-1">{inq.message}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-3 ${
                  inq.status === "open" ? "bg-amber-500/15 text-amber-400" :
                  inq.status === "replied" ? "bg-[#00d97e]/15 text-[#00d97e]" :
                  inq.status === "closed" ? "bg-white/[0.08] text-white/40" :
                  "bg-blue-500/15 text-blue-400"
                }`}>
                  {inq.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
