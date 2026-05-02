"use client";

/**
 * /admin/reddit — Reddit Community Operator Tool
 *
 * Next.js equivalent of the Streamlit dashboard.
 * Calls the FastAPI service directly (http://localhost:8088 by default).
 *
 * Tabs:
 *   1. Assist (v2)  — multi-AI pipeline, primary workflow
 *   2. Analyze (v1) — legacy regex + templates
 *   3. Analytics    — funnel metrics + recent sessions
 *   4. Scan Feed    — auto-detected posts from PRAW scanner
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, RefreshCw, Zap,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_API = "http://localhost:8088";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyPlan {
  validate_line?: string;
  hidden_tradeoff_line?: string;
  reframe_line?: string;
  reflective_question?: string;
  tool_intro?: string;
}

interface EVRoutineInvite {
  should_invite?: boolean;
  tool?: string;
  trigger_reason?: string;
  invite_text?: string;
}

interface AssistResponse {
  session_id?: string;
  intent?: string;
  secondary_intent?: string;
  suggested_tool?: string;
  user_state?: string;
  ownership_phase?: string;
  friction_tags?: string[];
  reply_plan?: ReplyPlan;
  draft_reply_short?: string;
  draft_reply_long?: string;
  tool_blurb?: string;
  safety_flags?: string[];
  is_offo_relevant?: boolean;
  confidence_score?: number;
  latency_ms?: number;
  pipeline_stages_used?: string[];
  evroutine_invite?: EVRoutineInvite;
  tech_support_flag?: { is_support_question: boolean; support_type?: string; suggested_reply_suffix?: string };
  detected_vehicle?: { year?: number; make?: string; model?: string; trim?: string; price_mentioned?: number; mileage_mentioned?: number };
  market_data?: { average_price?: number; price_spread?: string; sample_size?: number; price_percentile?: number };
  debug?: Record<string, unknown>;
}

interface AnalyzeResponse {
  intent?: string;
  user_state?: string;
  ownership_phase?: string;
  friction_tags?: string[];
  reply_plan?: ReplyPlan;
  draft_reply_short?: string;
  draft_reply_long?: string;
  tool_blurb?: string;
  safety_flags?: string[];
}

interface Session {
  id?: string;
  created_at?: string;
  mode?: string;
  source?: string;
  subreddit?: string;
  intent?: string;
  secondary_intent?: string;
  suggested_tool?: string;
  user_state?: string;
  evroutine_invited?: boolean;
  posted_outcome?: string;
  upvotes?: number;
  reply_count?: number;
  total_latency_ms?: number;
  detected_vehicle?: AssistResponse["detected_vehicle"];
  draft_reply_short?: string;
  post_title?: string;
  post_body?: string;
  reddit_post_url?: string;
  qualification_score?: number;
}

interface FunnelStats {
  total_sessions?: number;
  invites_shown?: number;
  invites_accepted?: number;
  acceptance_rate?: number;
  posted_count?: number;
  tag_frequency?: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, { icon: string; url: string; color: string }> = {
  routine:   { icon: "🧭", url: "offolab.com/routine",   color: "#2e86de" },
  receipt:   { icon: "🧾", url: "offolab.com/receipt",   color: "#10ac84" },
  compare:   { icon: "⚖️",  url: "offolab.com/compare",  color: "#ee5a24" },
  dealer_qa: { icon: "💬", url: "offolab.com/receipt",   color: "#8854d0" },
  dealer:    { icon: "🏢", url: "offolab.com/workspace", color: "#fd9644" },
};

function fitColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-orange-500";
}

function scoreColor(score: number) {
  if (score >= 0.80) return "bg-green-500";
  if (score >= 0.65) return "bg-yellow-400";
  return "bg-orange-500";
}

function FrictionBadges({ tags }: { tags?: string[] }) {
  if (!tags?.length) return <span className="text-gray-400 text-sm">— none detected</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200">{t}</span>
      ))}
    </div>
  );
}

function ToolIntroFlag({ intro }: { intro?: string }) {
  if (!intro || intro === "no") {
    return (
      <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
        <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
        <span className="font-semibold text-yellow-800">Tool intro: NO — do not add tool mention</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
      <span className="font-semibold text-green-800">Tool intro: {intro}</span>
    </div>
  );
}

function SafetyFlags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <div className="space-y-1.5 mt-3">
      {flags.map((f, i) => (
        <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{f}</span>
        </div>
      ))}
    </div>
  );
}

function DraftBox({ label, value, id }: { label: string; value?: string; id: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label} ({value.length} chars)</span>
        <button onClick={copy} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <textarea
        id={id}
        readOnly
        value={value}
        rows={5}
        className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 resize-y font-mono"
      />
    </div>
  );
}

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {label}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ["Assist (v2)", "Analyze (v1)", "Analytics", "Scan Feed", "Posted"] as const;
type Tab = typeof TABS[number];

const TONES = ["ultra_short", "standard", "empathetic", "technical"] as const;
const REGIONS = ["AUTO", "US", "UK", "CA", "EU"] as const;

export default function RedditOperatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Assist (v2)");
  const [apiBase, setApiBase] = useState(DEFAULT_API);
  const [apiHealth, setApiHealth] = useState<Record<string, boolean> | null>(null);
  const [tone, setTone] = useState<string>("standard");
  const [region, setRegion] = useState<string>("AUTO");
  const [subreddit, setSubreddit] = useState("");

  // Check API health on mount + when apiBase changes
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(4000) });
        const d = await r.json();
        setApiHealth(d.ai_clients ?? {});
      } catch {
        setApiHealth(null);
      }
    };
    check();
  }, [apiBase]);

  const post = useCallback(async (endpoint: string, payload: unknown) => {
    const r = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }, [apiBase]);

  const get = useCallback(async (endpoint: string, params?: Record<string, string | number>) => {
    const url = new URL(`${apiBase}${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }, [apiBase]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" /> OFFO Reddit Operator
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Multi-AI pipeline · Grok + Gemini + GPT-4o · EVRoutine funnel</p>
          </div>

          {/* Settings bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">API:</span>
              <input
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 w-44 font-mono"
              />
              <span className={`w-2 h-2 rounded-full ${apiHealth ? "bg-green-400" : "bg-red-400"}`} title={apiHealth ? "Online" : "Offline"} />
            </div>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1">
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
              placeholder="subreddit (optional)"
              className="text-xs border border-gray-200 rounded px-2 py-1 w-40"
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === "Assist (v2)" && (
          <AssistTab post={post} tone={tone} region={region} subreddit={subreddit} />
        )}
        {activeTab === "Analyze (v1)" && (
          <AnalyzeTab post={post} tone={tone} region={region} subreddit={subreddit} />
        )}
        {activeTab === "Analytics" && (
          <AnalyticsTab get={get} />
        )}
        {activeTab === "Scan Feed" && (
          <ScanFeedTab get={get} post={post} />
        )}
        {activeTab === "Posted" && (
          <PostedTab get={get} />
        )}
      </div>
    </div>
  );
}

// ─── Assist Tab (v2) ─────────────────────────────────────────────────────────

function AssistTab({ post, tone, region, subreddit }: {
  post: (ep: string, payload: unknown) => Promise<unknown>;
  tone: string; region: string; subreddit: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [comments, setComments] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistResponse | null>(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  const run = async () => {
    if (!body.trim() && !title.trim()) { setError("Enter a post title or body."); return; }
    setError(""); setLoading(true); setResult(null); setOutcome(null);
    try {
      const data = await post("/assist", {
        mode: "operator",
        source: "reddit",
        subreddit: subreddit || null,
        region_hint: region,
        tone,
        post_title: title || null,
        post_body: body,
        top_comment_context: comments.filter(Boolean),
      }) as AssistResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  };

  const recordOutcome = async (o: string, editedText?: string) => {
    if (!result?.session_id) return;
    try {
      await post(`/sessions/${result.session_id}/outcome`, {
        session_id: result.session_id,
        outcome: o,
        ...(editedText !== undefined ? { operator_edit: editedText } : {}),
      });
      setOutcome(o);
    } catch { setOutcome(o); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Input</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title (optional)"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the Reddit post text here…"
          rows={9} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:ring-2 focus:ring-blue-500 outline-none" />
        {comments.map((c, i) => (
          <input key={i} value={c} onChange={(e) => { const next = [...comments]; next[i] = e.target.value; setComments(next); }}
            placeholder={`Comment ${i + 1} (optional)`}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" />
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={run} disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Running pipeline…" : "Run Pipeline →"}
        </button>
        <p className="text-xs text-gray-400">Grok classifies · Gemini writes · GPT-4o checks · Grok polishes</p>
      </div>

      {/* Output */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Output</h2>
        {!result && !loading && (
          <div className="text-sm text-gray-400 italic">Results will appear here after running the pipeline.</div>
        )}
        {result && <AssistOutput result={result} outcome={outcome} onOutcome={recordOutcome} />}
      </div>
    </div>
  );
}

type DetectedVehicleType = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price_mentioned?: number;
  mileage_mentioned?: number;
};

function DetectedVehicleCard({ vehicle }: { vehicle: DetectedVehicleType }): React.ReactElement {
  return (
    <div className="text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
      <span>🚗 <strong>{[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")}</strong></span>
      {vehicle.price_mentioned != null && <span>· 💰 ${vehicle.price_mentioned.toLocaleString()}</span>}
      {vehicle.mileage_mentioned != null && <span>· 📍 {vehicle.mileage_mentioned.toLocaleString()} mi</span>}
    </div>
  );
}

function AssistOutput({ result, outcome, onOutcome }: {
  result: AssistResponse;
  outcome: string | null;
  onOutcome: (o: string, editedText?: string) => void;
}): React.ReactElement {
  const score = result.confidence_score ?? 0;
  const isRelevant = result.is_offo_relevant !== false;
  const [editedDraft, setEditedDraft] = useState(result.draft_reply_short ?? "");
  const detectedVehicle = result.detected_vehicle as DetectedVehicleType | undefined;

  return (
    <div className="space-y-4">
      {/* Pipeline + fit score */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {result.pipeline_stages_used != null ? (
          <span className="text-xs text-gray-500">{result.pipeline_stages_used.join(" → ")}</span>
        ) : null}
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${fitColor(score)}`}>
            Fit: {score}/100
          </span>
          {result.latency_ms && (
            <span className="text-xs text-gray-400">{result.latency_ms}ms</span>
          )}
        </div>
      </div>

      {!isRelevant && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <strong>Not OFFO-relevant</strong> — neutral reply generated. Do NOT mention any tools.
        </div>
      )}

      {/* Classification — 4 cols */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          ["Intent", result.intent ?? "—"],
          ["2nd Intent", result.secondary_intent ?? "—"],
          ["User state", result.user_state ?? "—"],
          ["Phase", result.ownership_phase ?? "—"],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{val}</p>
          </div>
        ))}
      </div>

      {detectedVehicle != null ? <DetectedVehicleCard vehicle={detectedVehicle} /> : null}

      {result.market_data != null && result.market_data.average_price != null ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs flex items-center gap-4 flex-wrap">
          <span className="font-medium text-gray-700">📊 Market</span>
          <span>Avg <strong>${result.market_data.average_price.toLocaleString()}</strong></span>
          {result.market_data.price_spread ? <span>Range {result.market_data.price_spread}</span> : null}
          {result.market_data.price_percentile != null ? (
            <span className={`px-2 py-0.5 rounded-full text-white font-semibold ${
              result.market_data.price_percentile <= 45 ? "bg-green-500" :
              result.market_data.price_percentile <= 60 ? "bg-yellow-500" : "bg-red-500"
            }`}>{result.market_data.price_percentile}th %ile</span>
          ) : null}
          {result.market_data.sample_size ? <span className="text-gray-400">{result.market_data.sample_size} comps</span> : null}
        </div>
      ) : null}

      {result.debug != null && (result.debug as Record<string, unknown>).key_concern != null ? (
        <p className="text-xs text-gray-500 italic">Key concern: {String((result.debug as Record<string, unknown>).key_concern)}</p>
      ) : null}

      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Friction tags</p>
        <FrictionBadges tags={result.friction_tags} />
      </div>

      {/* Reply plan */}
      {result.reply_plan != null ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Validate", result.reply_plan.validate_line],
            ["Hidden tradeoff", result.reply_plan.hidden_tradeoff_line],
            ["Reframe", result.reply_plan.reframe_line],
            ["Reflective question", result.reply_plan.reflective_question],
          ].map(([label, val]) => val ? (
            <div key={label} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
              <p className="text-gray-800 text-xs leading-relaxed">{val}</p>
            </div>
          ) : null)}
        </div>
      ) : null}

      <ToolIntroFlag intro={result.reply_plan?.tool_intro} />

      {/* EVRoutine invite */}
      {result.evroutine_invite?.should_invite === true ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
          <strong>{TOOL_LABELS[result.evroutine_invite.tool ?? "routine"]?.icon} Invite →</strong>{" "}
          {TOOL_LABELS[result.evroutine_invite.tool ?? "routine"]?.url}
          {result.evroutine_invite.trigger_reason ? (
            <span className="text-green-700"> · {result.evroutine_invite.trigger_reason}</span>
          ) : null}
          {result.evroutine_invite.invite_text ? (
            <DraftBox label="Invite text" value={result.evroutine_invite.invite_text} id="invite_text" />
          ) : null}
        </div>
      ) : null}

      {/* Draft replies */}
      <DraftBox label="Short draft (Grok polished)" value={result.draft_reply_short} id="short_v2" />
      <DraftBox label="Long draft" value={result.draft_reply_long} id="long_v2" />

      {result.tool_blurb ? (
        <div className="p-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
          <strong>EVRoutine blurb</strong> (only if appropriate): {result.tool_blurb}
        </div>
      ) : null}

      <SafetyFlags flags={result.safety_flags} />

      {/* Approve & Post */}
      {result.session_id != null ? (
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Approve &amp; Post</p>
          {outcome ? (
            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800 font-medium">
              ✓ Outcome saved: <strong>{outcome}</strong>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Edit before posting ({editedDraft.length} chars)</span>
                  <button onClick={() => setEditedDraft(result.draft_reply_short ?? "")}
                    className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
                </div>
                <textarea
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                  rows={5}
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-y font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOutcome("posted", editedDraft)}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">
                  ✅ Mark Posted
                </button>
                <button onClick={() => onOutcome("edited", editedDraft)}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">
                  ✏️ Edit then Post
                </button>
                <button onClick={() => onOutcome("skipped")}
                  className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg">
                  ⏭️ Skip
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <Collapsible label="Raw JSON">
        <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-2 rounded">{JSON.stringify(result, null, 2)}</pre>
      </Collapsible>
    </div>
  );
}

// ─── Analyze Tab (v1) ────────────────────────────────────────────────────────

function AnalyzeTab({ post, tone, region, subreddit }: {
  post: (ep: string, payload: unknown) => Promise<unknown>;
  tone: string; region: string; subreddit: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [comments, setComments] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!body.trim() && !title.trim()) { setError("Enter a post title or body."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const data = await post("/analyze", {
        source: "reddit",
        subreddit: subreddit || null,
        region_hint: region,
        tone,
        post_title: title || null,
        post_body: body,
        top_comment_context: comments.filter(Boolean),
      }) as AnalyzeResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Input <span className="text-gray-400 font-normal">(v1 — regex + templates)</span></h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title (optional)"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the Reddit post text here…"
          rows={9} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y outline-none focus:ring-2 focus:ring-blue-500" />
        {comments.map((c, i) => (
          <input key={i} value={c} onChange={(e) => { const next = [...comments]; next[i] = e.target.value; setComments(next); }}
            placeholder={`Comment ${i + 1} (optional)`}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" />
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={run} disabled={loading}
          className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Analyzing…" : "Analyze →"}
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Output</h2>
        {!result && !loading && <div className="text-sm text-gray-400 italic">Results will appear here.</div>}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[["Intent", result.intent], ["User state", result.user_state], ["Phase", result.ownership_phase]].map(([label, val]) => (
                <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{val || "—"}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Friction tags</p>
              <FrictionBadges tags={result.friction_tags} />
            </div>
            {result.reply_plan && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Validate", result.reply_plan.validate_line],
                  ["Hidden tradeoff", result.reply_plan.hidden_tradeoff_line],
                  ["Reframe", result.reply_plan.reframe_line],
                  ["Reflective question", result.reply_plan.reflective_question],
                ].map(([label, val]) => val ? (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                    <p className="text-gray-800 text-xs leading-relaxed">{val}</p>
                  </div>
                ) : null)}
              </div>
            )}
            <ToolIntroFlag intro={result.reply_plan?.tool_intro} />
            <DraftBox label="Short draft" value={result.draft_reply_short} id="short_v1" />
            <DraftBox label="Long draft" value={result.draft_reply_long} id="long_v1" />
            {result.tool_blurb && (
              <div className="p-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-800">
                <strong>EVRoutine blurb:</strong> {result.tool_blurb}
              </div>
            )}
            <SafetyFlags flags={result.safety_flags} />
            <Collapsible label="Raw JSON">
              <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-2 rounded">{JSON.stringify(result, null, 2)}</pre>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ get }: { get: (ep: string, params?: Record<string, string | number>) => Promise<unknown> }) {
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, r] = await Promise.all([
        get("/stats/funnel") as Promise<FunnelStats>,
        get("/stats/recent", { limit: 50 }) as Promise<{ analyses: Session[] }>,
      ]);
      setStats(s);
      setSessions((r as { analyses: Session[] }).analyses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Funnel Analytics</h2>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["Total sessions", stats.total_sessions ?? 0],
            ["Invites shown", stats.invites_shown ?? 0],
            ["Invites accepted", stats.invites_accepted ?? 0],
            ["Acceptance rate", `${((stats.acceptance_rate ?? 0) * 100).toFixed(1)}%`],
            ["Replies posted", stats.posted_count ?? 0],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{val}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Friction tag frequency */}
      {stats?.tag_frequency && Object.keys(stats.tag_frequency).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Friction tag frequency</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.tag_frequency)
              .sort(([, a], [, b]) => b - a)
              .map(([tag, count]) => {
                const max = Math.max(...Object.values(stats.tag_frequency!));
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-48 shrink-0 truncate">{tag}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent sessions table */}
      {sessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent sessions ({sessions.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Time", "Mode", "Subreddit", "Intent", "Tool", "State", "Outcome", "Latency"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-500">{(s.created_at ?? "").slice(0, 16).replace("T", " ")}</td>
                    <td className="px-3 py-1.5">{s.mode}</td>
                    <td className="px-3 py-1.5 text-gray-500">{s.subreddit || "—"}</td>
                    <td className="px-3 py-1.5">{s.intent}</td>
                    <td className="px-3 py-1.5">{s.suggested_tool ? `${TOOL_LABELS[s.suggested_tool]?.icon ?? "🔧"} ${s.suggested_tool}` : "—"}</td>
                    <td className="px-3 py-1.5">{s.user_state}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        s.posted_outcome === "posted" ? "bg-green-100 text-green-700" :
                        s.posted_outcome === "skipped" ? "bg-gray-100 text-gray-500" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{s.posted_outcome || "—"}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-400">{s.total_latency_ms ? `${s.total_latency_ms}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scan Feed Tab ────────────────────────────────────────────────────────────

function ScanFeedTab({ get, post }: {
  get: (ep: string, params?: Record<string, string | number>) => Promise<unknown>;
  post: (ep: string, payload: unknown) => Promise<unknown>;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await get("/stats/recent", { limit: 100 }) as { analyses: Session[] };
      const pending = (data.analyses ?? []).filter(
        (s) => s.source === "reddit_scanner" && s.posted_outcome === "pending"
      );
      setSessions(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { load(); }, [load]);

  const recordOutcome = async (sessionId: string, outcome: string) => {
    try {
      await post(`/sessions/${sessionId}/outcome`, { session_id: sessionId, outcome });
      setOutcomes((prev) => ({ ...prev, [sessionId]: outcome }));
    } catch {
      setOutcomes((prev) => ({ ...prev, [sessionId]: outcome }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Scan Feed — Auto-detected posts</h2>
          <p className="text-xs text-gray-500 mt-0.5">Posts found by PRAW scanner awaiting human review</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        Start scanner: <code className="font-mono bg-white border border-gray-200 rounded px-1">python reddit_scanner.py</code>
        &nbsp;·&nbsp;
        Dry run: <code className="font-mono bg-white border border-gray-200 rounded px-1">python reddit_scanner.py --dry-run --once</code>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-300 rounded-xl">
          No pending posts found. Start the scanner to populate this feed.
        </div>
      )}

      {sessions.map((s) => {
        const sessionId = s.id ?? "";
        const recorded = outcomes[sessionId];
        const qScore = s.qualification_score;
        return (
          <div key={sessionId} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-blue-700">r/{s.subreddit || "unknown"}</span>
                  {qScore != null && (
                    <span className={`px-2 py-0.5 rounded-full text-white text-xs font-bold ${scoreColor(qScore)}`}>
                      Score: {qScore.toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{(s.created_at ?? "").slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{s.post_title || "(no title)"}</p>
              </div>
              {s.reddit_post_url && (
                <a href={s.reddit_post_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-gray-400 hover:text-gray-700">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {s.post_body && (
              <p className="text-xs text-gray-600 line-clamp-3">{s.post_body}</p>
            )}

            {s.draft_reply_short && (
              <DraftBox label="Draft reply" value={s.draft_reply_short} id={`scan_draft_${sessionId}`} />
            )}

            {recorded ? (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800 font-medium">
                ✓ Outcome: <strong>{recorded}</strong>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => recordOutcome(sessionId, "posted")}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">✅ Posted</button>
                <button onClick={() => recordOutcome(sessionId, "edited")}
                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg">✏️ Edited</button>
                <button onClick={() => recordOutcome(sessionId, "skipped")}
                  className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg">⏭️ Skip</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Posted Tab ───────────────────────────────────────────────────────────────

interface PostedSession {
  id?: string;
  created_at?: string;
  subreddit?: string;
  post_title?: string;
  draft_reply_short?: string;
  reddit_post_id?: string;
  reddit_post_url?: string;
  posted_outcome?: string;
  upvotes?: number;
  reply_count?: number;
}

interface RedditComment {
  reddit_comment_id: string;
  comment_author?: string;
  comment_body: string;
  comment_score: number;
  is_reply_to_op?: boolean;
  comment_date?: string;
}

type GetFn = (ep: string, params?: Record<string, string | number>) => Promise<unknown>;

function CommentsDrawer({ sessionId, get }: { sessionId: string; get: GetFn }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (comments.length > 0) { setOpen((o) => !o); return; }
    setLoading(true);
    try {
      const data = await get(`/sessions/${sessionId}/comments`, { limit: 20 }) as { comments: RedditComment[] };
      setComments(data.comments ?? []);
      setOpen(true);
    } catch {
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={load} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
        {loading ? "Loading…" : open ? "▲ Hide" : "💬 Comments"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 min-w-[280px]">
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments stored yet — run outcome_tracker to fetch.</p>
          ) : (
            comments.map((c) => (
              <div key={c.reddit_comment_id} className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-700">u/{c.comment_author ?? "[deleted]"}</span>
                  <span className="text-gray-400">↑{c.comment_score}</span>
                  {c.is_reply_to_op && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">reply to OP</span>
                  )}
                </div>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{c.comment_body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PostedTab({ get }: { get: GetFn }) {
  const [sessions, setSessions] = useState<PostedSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await get("/sessions/posted", { limit: 50 }) as { sessions: PostedSession[] };
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "API error");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Posted Sessions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Replies marked as posted or edited, with upvote tracking</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-300 rounded-xl">
          No posted sessions yet. Mark replies as posted in the Assist tab.
        </div>
      )}

      {sessions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Time", "Subreddit", "Post Title", "Outcome", "Upvotes", "Replies", "Comments", "Draft"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{(s.created_at ?? "").slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2 text-blue-700 font-medium">{s.subreddit ? `r/${s.subreddit}` : "—"}</td>
                  <td className="px-3 py-2 max-w-[200px]">
                    {s.reddit_post_url ? (
                      <a href={s.reddit_post_url} target="_blank" rel="noopener noreferrer"
                        className="text-gray-800 hover:text-blue-700 flex items-center gap-1 truncate">
                        <span className="truncate">{s.post_title || "(no title)"}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="truncate text-gray-700">{s.post_title || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.posted_outcome === "posted" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>{s.posted_outcome}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-medium">{s.upvotes ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{s.reply_count ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.id && <CommentsDrawer sessionId={s.id} get={get} />}
                  </td>
                  <td className="px-3 py-2 max-w-[240px]">
                    <span className="truncate text-gray-500 block">{s.draft_reply_short ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
