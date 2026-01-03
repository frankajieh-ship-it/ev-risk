"use client";

import { Shield, Clock, AlertCircle, Calendar } from "lucide-react";

export default function TrustMicrocopy() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-600">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
        <span>No signup</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
        <span>~30 seconds</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
        <span>Fits your monthly routine</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
        <span>Shows what breaks first</span>
      </div>
    </div>
  );
}
