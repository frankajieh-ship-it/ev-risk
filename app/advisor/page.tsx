"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import Header from "@/components/landing/Header";
import OFfoChat from "@/components/chat/OFfoChat";
import { useAuth } from "@/hooks/useAuth";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import type { ChatContext, DealWatchMatch } from "@/components/chat/OFfoChat";

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

function DealMatchCard({ match }: { match: DealWatchMatch }) {
  const analyzeUrl = match.listing_url
    ? `/receipt?url=${encodeURIComponent(match.listing_url)}&src=deal_watch`
    : `/receipt?make=${encodeURIComponent(match.search_label)}&src=deal_watch`;

  const verdictColor =
    match.last_verdict === "buy" ? "text-[#00d97e]" :
    match.last_verdict === "pass" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{match.vehicle_label}</p>
          <p className="text-xs text-white/40 mt-0.5">{match.auction_source ?? match.search_label}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          {match.last_price != null && (
            <p className="text-sm font-semibold text-white">${match.last_price.toLocaleString()}</p>
          )}
          {match.last_verdict && (
            <p className={`text-xs mt-0.5 font-medium ${verdictColor}`}>{match.last_verdict}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <a
          href={analyzeUrl}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] px-3 py-1.5 rounded-lg transition-colors"
        >
          Run full analysis →
        </a>
        <p className="text-xs text-white/30">Check battery health, price, and dealer history</p>
      </div>
    </div>
  );
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
  const [dealMatches, setDealMatches] = useState<DealWatchMatch[]>([]);
  const [vehiclesMentioned, setVehiclesMentioned] = useState<string[]>([]);

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
            Get honest answers about buying a used EV - battery health, charging fit, price, or anything else on your mind.
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
              onNewChat={() => {
                setAdvisorSessionId(`adv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
                setDealMatches([]);
                setVehiclesMentioned([]);
              }}
              onMatchesFound={(matches, vehicles) => {
                setDealMatches(matches);
                setVehiclesMentioned(vehicles ?? []);
              }}
            />
          )}
        </div>

        {/* Deal matches — surfaces below chat when OFFO mentions vehicles */}
        {dealMatches.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
              Deals matching your conversation
            </h2>
            <div className="space-y-3">
              {dealMatches.map((m) => (
                <DealMatchCard key={m.listing_url || m.search_id} match={m} />
              ))}
            </div>
          </div>
        )}

        {/* No matches yet — prompt to set up Deal Watch for mentioned vehicles */}
        {dealMatches.length === 0 && vehiclesMentioned.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-sm font-medium text-white mb-1">Track these deals in real time</p>
            <p className="text-xs text-white/50 mb-3">
              OFFO can monitor {vehiclesMentioned.slice(0, 2).join(" and ")} listings and alert you when prices drop or a match shows up.
            </p>
            <a
              href={`/workspace/deal-watch${vehiclesMentioned[0] ? `?suggest=${encodeURIComponent(vehiclesMentioned[0])}` : ""}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#00d97e] hover:bg-[#00c970] text-[#0d1117] px-3 py-1.5 rounded-lg transition-colors"
            >
              Set up Deal Watch →
            </a>
          </div>
        )}

        {/* Recent conversations (logged-in users only) */}
        {isAuthenticated && recentSessions.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Recent conversations</h2>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div
                  key={s.advisor_session_id}
                  className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors group"
                >
                  <a
                    href={`/advisor?session=${s.advisor_session_id}`}
                    className="flex-1 min-w-0 flex items-start gap-3"
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
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!session?.access_token) return;
                      await fetch(`/api/advisor/sessions/${s.advisor_session_id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      setRecentSessions((prev) => prev.filter((x) => x.advisor_session_id !== s.advisor_session_id));
                    }}
                    className="flex-shrink-0 p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
