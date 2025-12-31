"use client";

import { Shield, Clock, AlertCircle, Database } from "lucide-react";

export default function TrustMicrocopy() {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-2 sm:gap-6 text-xs sm:text-sm text-gray-600">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
        <span>No signup required</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
        <span>Takes 30 seconds</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
        <span>Based on real owner experiences</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
        <span>Shows what breaks first</span>
      </div>
    </div>
  );
}
