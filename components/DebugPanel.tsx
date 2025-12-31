"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";

interface DebugPanelProps {
  normalizedInputs: Record<string, any>;
  derivedFeatures: Record<string, any>;
  ruleTriggers: string[];
  inputHash: string;
  confidence: any;
}

export default function DebugPanel({
  normalizedInputs,
  derivedFeatures,
  ruleTriggers,
  inputHash,
  confidence,
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 max-w-2xl z-50">
      <div className="bg-gray-900 text-white rounded-lg shadow-2xl border-2 border-yellow-500">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-yellow-500">DEBUG PANEL</span>
            <span className="text-xs bg-yellow-500 text-gray-900 px-2 py-0.5 rounded font-mono">
              {inputHash.slice(0, 8)}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronUp className="w-5 h-5" />
          )}
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Input Hash */}
            <div>
              <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2">Input Hash</h4>
              <code className="text-xs bg-gray-800 p-2 rounded block font-mono">
                {inputHash}
              </code>
              <p className="text-xs text-gray-400 mt-1">
                Unique fingerprint for this combination of inputs
              </p>
            </div>

            {/* Normalized Inputs */}
            <div>
              <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2">Normalized Inputs</h4>
              <div className="bg-gray-800 p-3 rounded text-xs font-mono space-y-1">
                {Object.entries(normalizedInputs).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-blue-300">{key}:</span>
                    <span className="text-green-300">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Derived Features */}
            <div>
              <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2">Derived Features</h4>
              <div className="bg-gray-800 p-3 rounded text-xs font-mono space-y-1">
                {Object.entries(derivedFeatures).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-purple-300">{key}:</span>
                    <span className="text-orange-300">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rule Triggers */}
            <div>
              <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2">
                Rule Triggers ({ruleTriggers.length})
              </h4>
              <div className="bg-gray-800 p-3 rounded text-xs space-y-1">
                {ruleTriggers.map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-300">{rule}</span>
                  </div>
                ))}
                {ruleTriggers.length === 0 && (
                  <p className="text-gray-500 italic">No rules triggered</p>
                )}
              </div>
            </div>

            {/* Output Verdict */}
            <div>
              <h4 className="text-xs font-bold text-yellow-500 uppercase mb-2">Output Verdict</h4>
              <div className="bg-gray-800 p-3 rounded text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-blue-300">Fit Signal:</span>
                  <span className="text-green-300 font-bold">{confidence.fit_signal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Score:</span>
                  <span className="text-green-300">{confidence.overall_score}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300">Confidence:</span>
                  <span className="text-green-300">{confidence.confidence}</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
              <p className="text-xs text-yellow-300">
                ⚠️ This panel is only visible with <code className="bg-gray-800 px-1 rounded">?debug=1</code> in the URL.
                It helps ensure distinct outputs for different input combinations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
