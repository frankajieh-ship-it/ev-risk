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
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Detail view
  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Inquiries
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900">{selected.subject}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {selected.inquiry_type} &middot; {new Date(selected.created_at).toLocaleDateString()}
            {selected.buyer_email && ` &middot; ${selected.buyer_email}`}
          </p>
          {selected.inventory_item && (
            <p className="text-xs text-gray-500 mt-1">
              Vehicle: {selected.inventory_item.year} {selected.inventory_item.make} {selected.inventory_item.model}
            </p>
          )}
          <p className="text-sm text-gray-700 mt-3">{selected.message}</p>
        </div>

        {/* Messages thread */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Conversation</h3>
          </div>

          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No replies yet. Send the first response below.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`px-5 py-3 ${msg.sender_role === "dealer" ? "bg-green-50/50" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${msg.sender_role === "dealer" ? "text-green-700" : "text-blue-700"}`}>
                      {msg.sender_role === "dealer" ? "You" : "Buyer"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
              placeholder="Type your reply..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
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
      <h1 className="text-xl font-bold text-gray-900 mb-6">Inquiries</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-green-50 text-green-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No inquiries found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inq) => (
            <button
              key={inq.id}
              onClick={() => openInquiry(inq)}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inq.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {inq.inquiry_type} &middot; {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">{inq.message}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-3 ${
                  inq.status === "open" ? "bg-yellow-50 text-yellow-700" :
                  inq.status === "replied" ? "bg-green-50 text-green-700" :
                  inq.status === "closed" ? "bg-gray-100 text-gray-600" :
                  "bg-blue-50 text-blue-700"
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
