"use client";

/**
 * Behavioral Pattern Analysis Dashboard
 *
 * Access: /admin/patterns (requires admin API key)
 * Purpose: Analyze Mental Overhead research patterns
 */

import { useState, useEffect } from "react";
import type { BehavioralPatternRecord, PatternAnalysis } from "@/types/behavioralPatterns";
import QuickPatternCapture from "./components/QuickPatternCapture";
import InsightCards from "./components/InsightCards";

interface PatternAnalysisResponse {
  success: boolean;
  total_patterns: number;
  pattern_clusters: PatternAnalysis[];
  insights: {
    summary: string;
    avg_cognitive_load: number;
    perception_gap_rate: number;
    adaptation_success_rate: number;
    recommendations: string[];
  };
}

interface PatternListResponse {
  success: boolean;
  count: number;
  patterns: BehavioralPatternRecord[];
}

export default function PatternAnalysisDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<PatternAnalysisResponse | null>(null);
  const [patterns, setPatterns] = useState<BehavioralPatternRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"analysis" | "patterns" | "submit">("analysis");

  const authenticate = () => {
    if (!apiKey.trim()) {
      setError("Please enter API key");
      return;
    }
    setAuthenticated(true);
    setError("");
    loadAnalysis();
    loadPatterns();
  };

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patterns/analysis?key=${apiKey}`);
      if (res.status === 401) {
        setError("Invalid API key");
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError("Failed to load analysis: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const res = await fetch(`/api/patterns?key=${apiKey}`);
      if (res.status === 401) {
        setError("Invalid API key");
        setAuthenticated(false);
        return;
      }
      const data: PatternListResponse = await res.json();
      setPatterns(data.patterns);
    } catch (err: any) {
      setError("Failed to load patterns: " + err.message);
    }
  };

  const submitPattern = async (patternData: any) => {
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patternData),
      });

      const data = await res.json();

      if (data.success) {
        alert(`✓ Pattern recorded: ${data.pattern_id}`);
        // Reload data
        loadAnalysis();
        loadPatterns();
        // Switch to analysis tab to see new pattern
        setActiveTab("analysis");
      } else {
        setError("Failed to submit pattern: " + data.error);
      }
    } catch (err: any) {
      setError("Failed to submit pattern: " + err.message);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Behavioral Pattern Analysis</h1>
          <p className="text-gray-600 mb-6">Enter admin API key to access pattern tracking dashboard</p>
          <input
            type="password"
            placeholder="Admin API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            className="w-full p-3 border rounded mb-4"
          />
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <button
            onClick={authenticate}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700"
          >
            Access Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Behavioral Pattern Analysis</h1>
            <p className="text-gray-600 mt-2">Mental Overhead Research Dashboard</p>
          </div>
          <a
            href="/admin"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to Main Admin
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-6 py-3 font-medium ${
              activeTab === "analysis"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Pattern Analysis
          </button>
          <button
            onClick={() => setActiveTab("patterns")}
            className={`px-6 py-3 font-medium ${
              activeTab === "patterns"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            All Patterns ({patterns.length})
          </button>
          <button
            onClick={() => setActiveTab("submit")}
            className={`px-6 py-3 font-medium ${
              activeTab === "submit"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Submit New Pattern
          </button>
        </div>

        {loading && <p className="text-center py-8">Loading...</p>}
        {error && <p className="text-red-600 mb-4">{error}</p>}

        {/* Analysis Tab */}
        {activeTab === "analysis" && analysis && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <p className="text-gray-700 mb-4">{analysis.insights.summary}</p>
              {analysis.total_patterns > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Avg Cognitive Load</p>
                    <p className="text-2xl font-bold">
                      {analysis.insights.avg_cognitive_load?.toFixed(1) ?? "—"}/5
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Perception Gap Rate</p>
                    <p className="text-2xl font-bold">
                      {analysis.insights.perception_gap_rate != null
                        ? (analysis.insights.perception_gap_rate * 100).toFixed(0)
                        : "—"}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Adaptation Success</p>
                    <p className="text-2xl font-bold">
                      {analysis.insights.adaptation_success_rate != null
                        ? (analysis.insights.adaptation_success_rate * 100).toFixed(0)
                        : "—"}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No patterns collected yet. Submit your first pattern using the &quot;Submit New Pattern&quot; tab.
                </p>
              )}
            </div>

            {/* Recommendations */}
            {analysis.insights.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold mb-3">Product Recommendations</h3>
                <ul className="space-y-2">
                  {analysis.insights.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start">
                      <span className="text-blue-600 mr-2">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pattern Clusters */}
            <div>
              <h2 className="text-xl font-bold mb-4">Pattern Insights</h2>
              <InsightCards
                clusters={analysis.pattern_clusters || []}
                totalPatterns={analysis.total_patterns}
              />
            </div>
          </div>
        )}

        {/* Patterns List Tab */}
        {activeTab === "patterns" && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">All Patterns ({patterns.length})</h2>
            </div>
            <div className="divide-y max-h-[800px] overflow-y-auto">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">{pattern.source}</span>
                      <span className="text-xs text-gray-500 ml-2">{pattern.user_context.housing}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {pattern.user_context.ownership_stage}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(pattern.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Assumption:</strong>{" "}
                      <span className="text-gray-700">
                        {pattern.behavioral_pattern.pre_purchase_assumption}
                      </span>
                    </div>
                    <div>
                      <strong>Reality:</strong>{" "}
                      <span className="text-gray-700">
                        {pattern.behavioral_pattern.actual_experience}
                      </span>
                    </div>
                    <div>
                      <strong>Root Cause:</strong>{" "}
                      <span className="text-gray-700">{pattern.behavioral_pattern.root_cause}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>Cognitive Load: {pattern.behavioral_pattern.cognitive_load_rating}/5</span>
                      <span>Outcome: {pattern.behavioral_pattern.outcome}</span>
                    </div>
                    {pattern.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {pattern.tags.map((tag, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Pattern Tab */}
        {activeTab === "submit" && (
          <div className="bg-white rounded-lg shadow p-6">
            <QuickPatternCapture
              onSubmit={submitPattern}
              onCancel={() => setActiveTab("analysis")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
