/**
 * RecallBadge
 *
 * Small pill shown on a garage vehicle card when active recalls exist.
 * Fetches recall count for the given vehicleId on mount.
 * Renders nothing if there are no active recalls or while loading.
 *
 * Props:
 *   vehicleId    — the garage_vehicles UUID
 *   authToken    — Bearer token from session.access_token
 *   onViewRecalls — callback receives the full recalls array when clicked
 */
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export interface Recall {
  id: string;
  vehicle_id: string;
  recall_id: string;
  title: string;
  description: string | null;
  consequence: string | null;
  remedy: string | null;
  manufacturer: string | null;
  recall_date: string | null;
  component: string | null;
  routine_impact_score: number;
  is_safety_critical: boolean;
  affected_systems: string[];
  ai_summary: string | null;
  status: string;
  created_at: string;
}

interface RecallBadgeProps {
  vehicleId: string;
  authToken: string;
  onViewRecalls: (recalls: Recall[]) => void;
}

export default function RecallBadge({ vehicleId, authToken, onViewRecalls }: RecallBadgeProps) {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId || !authToken) {
      setLoading(false);
      return;
    }
    fetch(`/api/recalls?vehicle_id=${vehicleId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRecalls(data.recalls || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vehicleId, authToken]);

  if (loading || recalls.length === 0) return null;

  const hasCritical = recalls.some((r) => r.is_safety_critical);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onViewRecalls(recalls);
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-75 ${
        hasCritical
          ? "bg-red-100 text-red-700 border border-red-300"
          : "bg-amber-100 text-amber-700 border border-amber-300"
      }`}
      title={`${recalls.length} active recall${recalls.length !== 1 ? "s" : ""} — click to view`}
    >
      <AlertTriangle size={10} />
      {recalls.length} Recall{recalls.length !== 1 ? "s" : ""}
    </button>
  );
}
