"use client";

import { Upload } from "lucide-react";

export default function PhotoUploadPlaceholder() {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="text-center">
        <p className="text-sm font-medium text-gray-600 mb-3">
          Or upload photos (coming soon)
        </p>
        <button
          type="button"
          disabled
          className="w-full px-4 py-3 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Upload className="w-5 h-5" />
          <span className="font-medium">Upload photos (coming soon)</span>
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Soon you'll be able to upload listing screenshots and confirm extracted details.
        </p>
      </div>
    </div>
  );
}
