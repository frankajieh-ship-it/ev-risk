"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/landing/Header";
import OFfoChat from "@/components/chat/OFfoChat";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import type { ChatContext } from "@/components/chat/OFfoChat";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AdvisorSession {
  advisor_session_id: string;
  preview: string;
  created_at: string;
  message_count: number;
}

function AdvisorContent() {
  const searchParams = useSearchParams();
  const { user, session, isAuthenticated } = useAuth();

  // Initialize synchronously from URL params and persistent session — avoids setState-in-effect lint errors
  const resumeSessionParam = searchParams.get("session");
  const [sessionId] = useState<string>(() => getOrCreatePersistentSessionId() ?? `advisor_${Date.now()}`);
  const [advisorSessionId, setAdvisorSessionId] = useState<string>(() =>
    resumeSessionParam ?? `adv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [recentSessions, setRecentSessions] = useState<AdvisorSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load session history if resuming
  useEffect(() => {
    if (!resumeSessionParam || !isAuthenticated || !session?.access_token) return;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const r = await fetch(`/api/advisor/sessions/${resumeSessionParam}`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        const data = await r.json();
        if (data.messages) {
          setInitialMessages(
            (data.messages as { role: string; content: string; created_at: string }[]).map((m) => ({
              id: `hist_${m.created_at}`,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      } catch {
        // silent
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [isAuthenticated, session?.access_token, resumeSessionParam]);

  // Load recent sessions for logged-in users
  useEffect(() => {
    if (!isAuthenticated || !session?.access_token) return;
    fetch("/api/advisor/sessions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setRecentSessions(data.sessions);
      })
      .catch(() => {});
  }, [isAuthenticated, session?.access_token]);

  const context: ChatContext = {};

  if (!sessionId) return null;

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 bg-[#00d97e]/10 rounded-full border border-[#00d97e]/20">
            <span className="w-2 h-2 rounded-full bg-[#00d97e] animate-pulse" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider">Free</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Ask OFFO</h1>
          <p className="text-sm text-white/50">
            Get honest answers about buying a used EV — battery health, charging fit, price, or anything else on your mind.
          </p>
        </div>

        {/* Chat panel */}
        <div className="h-[600px]">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-[#00d97e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <OFfoChat
              scenarioType="advisor"
              scenarioId="advisor"
              sessionId={sessionId}
              context={context}
              paymentsEnabled={false}
              freeMode={true}
              inline={true}
              initialMessages={initialMessages}
              userId={user?.id ?? null}
              advisorSessionId={advisorSessionId}
              getAccessToken={session ? async () => session.access_token : undefined}
              onNewChat={() => setAdvisorSessionId(`adv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)}
            />
          )}
        </div>

        {/* Recent conversations (logged-in users only) */}
        {isAuthenticated && recentSessions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Recent conversations</h2>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <a
                  key={s.advisor_session_id}
                  href={`/advisor?session=${s.advisor_session_id}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate group-hover:text-white/90">{s.preview}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {s.message_count} message{s.message_count !== 1 ? "s" : ""} ·{" "}
                      {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className="text-white/20 group-hover:text-white/50 text-xs flex-shrink-0 mt-0.5">→</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <Suspense>
      <AdvisorContent />
    </Suspense>
  );
}
