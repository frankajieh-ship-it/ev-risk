"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import PhotoUploadPlaceholder from "./PhotoUploadPlaceholder";
import { useSessionTracking } from "@/hooks/useSessionTracking";

export interface ManualEntryData {
  year: number;
  make: string;
  model: string;
  mileage?: number;
  batteryInfoAvailable: boolean;
  dataSource: 'manual-entry';
  missingFields: string[];
}

interface ManualEntryInlineFormProps {
  onSubmit: (data: ManualEntryData) => void;
}

const currentYear = new Date().getFullYear();

// Common EV makes for dropdown
const EV_MAKES = [
  "Tesla",
  "Chevrolet",
  "Nissan",
  "Ford",
  "Hyundai",
  "Kia",
  "BMW",
  "Audi",
  "Volkswagen",
  "Rivian",
  "Lucid",
  "Polestar",
  "Mercedes-Benz",
  "Porsche",
  "Other"
];

// Mileage buckets for easy selection
const MILEAGE_OPTIONS = [
  { value: 5000, label: "Under 10k miles" },
  { value: 20000, label: "10k - 30k miles" },
  { value: 45000, label: "30k - 60k miles" },
  { value: 75000, label: "60k - 90k miles" },
  { value: 100000, label: "90k+ miles" },
];

export default function ManualEntryInlineForm({ onSubmit }: ManualEntryInlineFormProps) {
  const [year, setYear] = useState<number>(currentYear);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState<number | undefined>(undefined);
  const [batteryInfoAvailable, setBatteryInfoAvailable] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);

  // Session tracking
  const { startSession, completeSession } = useSessionTracking();
  const sessionStartedRef = useRef(false);

  // Start session tracking on mount
  useEffect(() => {
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      startSession({ source: "manual-entry" }).catch(() => {
        // Silent fail - don't block user flow
      });
    }
  }, [startSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!make || !model) {
      alert("Please fill in Make and Model (required fields)");
      return;
    }

    setSubmitting(true);

    // Track missing fields
    const missingFields: string[] = [];
    if (!mileage) missingFields.push("mileage");
    if (!batteryInfoAvailable) missingFields.push("battery health");

    const data: ManualEntryData = {
      year,
      make: make.trim(),
      model: model.trim(),
      mileage,
      batteryInfoAvailable,
      dataSource: 'manual-entry',
      missingFields,
    };

    // Track session completion with inputs
    completeSession(
      {
        year,
        make: make.trim(),
        model: model.trim(),
        mileage,
        batteryInfoAvailable,
        dataSource: 'manual-entry',
      },
      {} // No fit_signal yet - that comes after results
    ).catch(() => {
      // Silent fail
    });

    onSubmit(data);

    // Reset submitting state after a delay (parent will handle navigation)
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Year + Make Row (Desktop: 2 cols, Mobile: 1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Year <span className="text-red-600">*</span>
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={submitting}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            required
          >
            {Array.from({ length: 12 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Make */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Make <span className="text-red-600">*</span>
          </label>
          <select
            value={make}
            onChange={(e) => setMake(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            required
          >
            <option value="">Select Make...</option>
            {EV_MAKES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g., Model 3, Bolt EV, Leaf"
          disabled={submitting}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
          required
        />
      </div>

      {/* Mileage + Battery Info Row (Desktop: 2 cols, Mobile: 1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mileage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mileage <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <select
            value={mileage || ""}
            onChange={(e) => setMileage(e.target.value ? Number(e.target.value) : undefined)}
            disabled={submitting}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
          >
            <option value="">Select range...</option>
            {MILEAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Battery Info Available */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Battery info available? <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="batteryInfo"
                checked={batteryInfoAvailable === true}
                onChange={() => setBatteryInfoAvailable(true)}
                disabled={submitting}
                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-sm text-gray-700">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="batteryInfo"
                checked={batteryInfoAvailable === false}
                onChange={() => setBatteryInfoAvailable(false)}
                disabled={submitting}
                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <span className="text-sm text-gray-700">No</span>
            </label>
          </div>
        </div>
      </div>

      {/* Photo Upload Placeholder */}
      <PhotoUploadPlaceholder />

      {/* Missing Data Warning */}
      {(!mileage || !batteryInfoAvailable) && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Some details are missing</p>
            <p className="text-xs mt-1">
              We'll show what we can infer and what would improve confidence.
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || !make || !model}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Generating Report..." : "Generate Report"}
        </button>
        <p className="text-xs text-center text-gray-500 mt-2">
          We'll show what we can infer, what's missing, and what would improve confidence.
        </p>
      </div>
    </form>
  );
}
