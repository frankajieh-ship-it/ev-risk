"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Car } from "lucide-react";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ManualVehicleData) => void;
  missingFields: string[];
}

export interface ManualVehicleData {
  make: string;
  model: string;
  year: number;
  mileage?: number;
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

export default function ManualEntryModal({
  isOpen,
  onClose,
  onSubmit,
  missingFields,
}: ManualEntryModalProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(currentYear);
  const [mileage, setMileage] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!make || !model || !year) {
      alert("Please fill in Make, Model, and Year (required fields)");
      return;
    }

    setSubmitting(true);

    const data: ManualVehicleData = {
      make: make.trim(),
      model: model.trim(),
      year,
      mileage,
    };

    onSubmit(data);
  };

  const handleClose = () => {
    if (!submitting) {
      setMake("");
      setModel("");
      setYear(currentYear);
      setMileage(undefined);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={handleClose}
                  disabled={submitting}
                  className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Header */}
                <div className="bg-gradient-to-br from-blue-50 to-green-50 p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg">
                      <Car className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Enter Vehicle Details
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    We couldn't automatically extract the listing. Please provide these details manually.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {/* Make (Dropdown) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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

                  {/* Model (Text Input) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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

                  {/* Year (Dropdown) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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

                  {/* Mileage (Optional - Buckets) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <p className="text-xs text-gray-500 mt-1">
                      Helps us estimate battery health and wear
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={submitting || !make || !model || !year}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? "Generating Report..." : "Continue to Report"}
                    </button>
                  </div>

                  {/* Helper Text */}
                  <p className="text-xs text-center text-gray-500">
                    We'll use this information to generate your fit assessment
                  </p>
                </form>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
