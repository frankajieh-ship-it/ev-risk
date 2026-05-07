"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Battery, TrendingUp, TrendingDown, Minus, Clock, Info, Microscope } from "lucide-react";

interface SOHSubmitFormProps {
  vehicleYear?: number;
  vehicleModel?: string;
  receiptId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function SOHSubmitForm({ vehicleYear, vehicleModel, receiptId, onSuccess, onCancel }: SOHSubmitFormProps) {
  const [sohPct, setSohPct] = useState("");
  const [obdTool, setObdTool] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [currentMileage, setCurrentMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = parseFloat(sohPct);
    if (isNaN(pct) || pct < 50 || pct > 100) {
      setError("SOH must be between 50 and 100");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/battery/soh-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId,
          vehicleYear,
          vehicleModel,
          reportedSohPct: pct,
          obdTool: obdTool || undefined,
          readingDate,
          currentMileage: currentMileage ? parseInt(currentMileage, 10) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Network error — please try again");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-gray-600 mb-0.5">SOH % *</label>
          <input
            type="number" min={50} max={100} step={0.1} required
            value={sohPct} onChange={e => setSohPct(e.target.value)}
            placeholder="e.g. 91.5"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Reading date *</label>
          <input
            type="date" required
            value={readingDate} onChange={e => setReadingDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">OBD tool</label>
          <select
            value={obdTool} onChange={e => setObdTool(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Select…</option>
            <option value="leaf_spy">LeafSpy</option>
            <option value="torque">Torque Pro</option>
            <option value="manufacturer_app">Manufacturer app</option>
            <option value="obdii_generic">Generic OBD-II</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-600 mb-0.5">Current odometer</label>
          <input
            type="number" min={0}
            value={currentMileage} onChange={e => setCurrentMileage(e.target.value)}
            placeholder="miles"
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-gray-600 mb-0.5">Notes (optional)</label>
        <input
          type="text" maxLength={200}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. summer reading, short trip before"
          className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      {error && <p className="text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit" disabled={submitting}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 text-gray-500 hover:underline text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

interface BatteryHealthContextProps {
  currentHealth: number;
  assessment: "typical" | "above-average" | "below-average" | "unusually-strong" | "faster-decline";
  comparisonText: string;
  benchmarkNote: string;
  widthReason?: string;
  calendarAgingDominant?: boolean;
  calendarAgingNote?: string;
  calendarLeadsCaution?: boolean;
  calendarLeadsNote?: string;
  showSOHPrompt?: boolean;
  vehicleYear?: number;
  vehicleModel?: string;
  receiptId?: string;
}

export default function BatteryHealthContext({
  currentHealth,
  assessment,
  comparisonText,
  benchmarkNote,
  widthReason,
  calendarAgingDominant,
  calendarAgingNote,
  calendarLeadsCaution,
  calendarLeadsNote,
  showSOHPrompt,
  vehicleYear,
  vehicleModel,
  receiptId,
}: BatteryHealthContextProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const getAssessmentStyle = () => {
    switch (assessment) {
      case "unusually-strong":
        return {
          bg: "bg-green-50",
          border: "border-green-300",
          icon: TrendingUp,
          iconColor: "text-green-600",
          textColor: "text-green-800",
          badge: "bg-green-100 text-green-700 border-green-300",
        };
      case "above-average":
        return {
          bg: "bg-green-50/50",
          border: "border-green-200",
          icon: TrendingUp,
          iconColor: "text-green-500",
          textColor: "text-green-700",
          badge: "bg-green-50 text-green-700 border-green-200",
        };
      case "typical":
        return {
          bg: "bg-blue-50/30",
          border: "border-blue-200",
          icon: Minus,
          iconColor: "text-blue-600",
          textColor: "text-blue-800",
          badge: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case "below-average":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: TrendingDown,
          iconColor: "text-amber-700",
          textColor: "text-amber-900",
          badge: "bg-amber-100 text-amber-900 border-amber-200",
        };
      case "faster-decline":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: TrendingDown,
          iconColor: "text-red-600",
          textColor: "text-red-800",
          badge: "bg-red-100 text-red-700 border-red-200",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          icon: Battery,
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
          badge: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const style = getAssessmentStyle();
  const Icon = style.icon;

  return (
    <div className="space-y-2">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`${style.bg} border-2 ${style.border} rounded-xl p-5 inline-flex items-center gap-4`}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon className={`w-6 h-6 ${style.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-bold ${style.textColor} text-lg`}>
              {comparisonText}
            </h4>
          </div>
          <p className="text-xs text-gray-600 italic">
            {benchmarkNote}
          </p>
          {widthReason && (
            <p className="text-xs text-gray-500 mt-1">
              {widthReason}
            </p>
          )}
        </div>

        {/* Badge */}
        <div className="flex-shrink-0">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${style.badge}`}>
            {currentHealth.toFixed(0)}% Health
          </span>
        </div>
      </motion.div>

      {calendarAgingDominant && calendarAgingNote && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
        >
          <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">{calendarAgingNote}</p>
        </motion.div>
      )}

      {calendarLeadsCaution && calendarLeadsNote && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3"
        >
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">{calendarLeadsNote}</p>
        </motion.div>
      )}

      {showSOHPrompt && (
        <div className="border-t border-gray-100 pt-3 mt-1">
          {submitted ? (
            <p className="text-xs text-green-600">✓ Reading submitted — thank you for improving accuracy</p>
          ) : formOpen ? (
            <SOHSubmitForm
              vehicleYear={vehicleYear}
              vehicleModel={vehicleModel}
              receiptId={receiptId}
              onSuccess={() => { setFormOpen(false); setSubmitted(true); }}
              onCancel={() => setFormOpen(false)}
            />
          ) : (
            <button
              onClick={() => setFormOpen(true)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Microscope className="w-3 h-3" />
              Have an OBD reader? Submit your actual SOH reading
            </button>
          )}
        </div>
      )}
    </div>
  );
}
