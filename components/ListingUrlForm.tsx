"use client";

import { useState } from "react";
import { Link2, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface ListingUrlFormProps {
  onExtract: (url: string) => Promise<void>;
  extracting: boolean;
  error: string | null;
  warnings: string[];
}

export default function ListingUrlForm({
  onExtract,
  extracting,
  error,
  warnings,
}: ListingUrlFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || extracting) return;
    await onExtract(url.trim());
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-blue-300 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl">
          <Link2 className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Listing URL Scanner
          </h3>
          <p className="text-sm text-gray-600">
            Paste AutoTrader, CarGurus, or Cars.com link
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.autotrader.com/cars-for-sale/..."
            disabled={extracting}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-sm"
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <div className="font-medium mb-1">{error}</div>
              {warnings.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  {warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={!url.trim() || extracting}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {extracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Scanning listing...
            </>
          ) : (
            <>
              Scan Listing
            </>
          )}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          We'll extract vehicle details and analyze fit for your routine
        </p>
      </div>
    </div>
  );
}
