/**
 * ModelInfoSection — External resource links for a vehicle model
 *
 * Shows recall lookup, Wikipedia, manufacturer support, owner manual, warranty links.
 * All links are deterministic and open in new tabs.
 */

"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Shield,
  AlertTriangle,
  Globe,
  Building,
  ExternalLink,
} from "lucide-react";
import type { Region } from "@/lib/region";

interface ModelResource {
  type: string;
  label: string;
  url: string;
  description: string;
}

interface ModelInfoSectionProps {
  make: string;
  model: string;
  year?: number;
  region?: Region;
  trackEvent?: (eventName: string, eventData?: Record<string, unknown>) => void;
}

const ICON_MAP: Record<string, typeof BookOpen> = {
  recall: AlertTriangle,
  wikipedia: Globe,
  manufacturer: Building,
  manual: BookOpen,
  warranty: Shield,
};

export default function ModelInfoSection({
  make,
  model,
  year,
  region = "US",
  trackEvent,
}: ModelInfoSectionProps) {
  const [resources, setResources] = useState<ModelResource[]>([]);

  useEffect(() => {
    if (!make || !model) return;
    let cancelled = false;

    const params = new URLSearchParams({ make, model });
    if (year) params.set("year", String(year));
    params.set("country_mode", region === "UK" ? "UK" : "US");

    fetch(`/api/model/resources?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.resources) {
          setResources(data.resources);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [make, model, year, region]);

  if (resources.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">
        Research this {make} {model}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {resources.map((r) => {
          const Icon = ICON_MAP[r.type] || Globe;
          return (
            <a
              key={r.type}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent?.("model_info_link_clicked", {
                  link_type: r.type,
                  make,
                  model,
                });
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
            >
              <Icon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700 truncate">
                  {r.label}
                </p>
              </div>
              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
