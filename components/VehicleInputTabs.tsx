"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link as LinkIcon, Edit3 } from "lucide-react";
import ListingUrlForm from "./ListingUrlForm";
import ManualEntryInlineForm, { type ManualEntryData } from "./ManualEntryInlineForm";
import { useEventTracking } from "@/hooks/useEventTracking";

interface VehicleInputTabsProps {
  // Listing URL props
  onExtract: (url: string) => Promise<void>;
  extracting: boolean;
  error: string | null;
  warnings: string[];
  extractedData?: {
    model: string;
    year: number;
    currentMileage: number;
    actualMileage?: number;
    price?: number;
    vin?: string;
  } | null;
  onConfirm?: () => void;
  onReset?: () => void;

  // Manual entry props
  onManualSubmit: (data: ManualEntryData) => void;
}

type TabType = "url" | "manual";

export default function VehicleInputTabs({
  onExtract,
  extracting,
  error,
  warnings,
  extractedData,
  onConfirm,
  onReset,
  onManualSubmit,
}: VehicleInputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("url");
  const { trackEvent } = useEventTracking();

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);

    // Track entry mode selection
    trackEvent("entry_mode_selected", {
      entry_mode: tabId === "url" ? "listing_url" : "manual_entry",
      context: "homepage"
    });
  };

  const tabs = [
    {
      id: "url" as const,
      label: "Listing URL",
      icon: LinkIcon,
      description: "Paste a link from AutoTrader, Carvana, etc.",
    },
    {
      id: "manual" as const,
      label: "Manual Entry",
      icon: Edit3,
      description: "Already have an EV (or no listing link)? Enter a few details.",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50/50">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 relative px-4 py-4 text-left transition-all ${
                  isActive
                    ? "bg-white"
                    : "bg-transparent hover:bg-gray-100/50"
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-green-600"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}

                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                  <span className={`font-semibold ${isActive ? "text-gray-900" : "text-gray-600"}`}>
                    {tab.label}
                  </span>
                </div>
                <p className={`text-xs ${isActive ? "text-gray-600" : "text-gray-500"}`}>
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "url" ? (
            <ListingUrlForm
              onExtract={onExtract}
              extracting={extracting}
              error={error}
              warnings={warnings}
              extractedData={extractedData}
              onConfirm={onConfirm}
              onReset={onReset}
            />
          ) : (
            <ManualEntryInlineForm onSubmit={onManualSubmit} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
