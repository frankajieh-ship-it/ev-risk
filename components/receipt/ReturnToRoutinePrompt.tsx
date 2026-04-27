"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface ReturnToRoutinePromptProps {
  vehicleReady: boolean;
  onReturn: () => void;
}

export default function ReturnToRoutinePrompt({ vehicleReady, onReturn }: ReturnToRoutinePromptProps) {
  if (vehicleReady) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 p-4 bg-[#00d97e]/10 rounded-2xl border border-[#00d97e]/20"
      >
        <p className="text-sm font-medium text-white mb-2">
          Vehicle data extracted! Return to your routine analysis to see updated results.
        </p>
        <button
          onClick={onReturn}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Routine with Vehicle Data
        </button>
      </motion.div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-white/[0.05] rounded-xl border border-white/10">
      <p className="text-xs text-white/50">
        Paste a listing URL above to extract vehicle data, then return to your routine analysis.
      </p>
    </div>
  );
}
