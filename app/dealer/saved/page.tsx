"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2, ExternalLink, Car, Loader2, RefreshCw, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAnonGarage, removeFromAnonGarage, type AnonGarageItem } from "@/lib/anon-garage";

interface SavedVehicle {
  id: string;
  label: string;
  type: AnonGarageItem["type"];
  saved_at: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  mileage?: number;
  source?: string;
  url?: string;
}

function parseSavedItem(item: AnonGarageItem): SavedVehicle {
  const d = item.data as Record<string, unknown>;
  return {
    id: item.id,
    label: item.label,
    type: item.type,
    saved_at: item.saved_at,
    vin: d.vin as string | undefined,
    make: d.make as string | undefined,
    model: d.model as string | undefined,
    year: d.year as number | undefined,
    price: d.price as number | undefined,
    mileage: d.mileage as number | undefined,
    source: d.source as string | undefined,
    url: d.url as string | undefined,
  };
}

export default function DealerSavedPage() {
  const { session } = useAuth();
  const [localItems, setLocalItems] = useState<SavedVehicle[]>(() =>
    getAnonGarage().map(parseSavedItem)
  );
  const [serverItems, setServerItems] = useState<SavedVehicle[]>([]);
  const [loading, setLoading] = useState(() => !!session?.access_token);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/workspace/garage", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const srv = (data.items || []) as AnonGarageItem[];
        setServerItems(srv.map(parseSavedItem));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const allItems = [
    ...serverItems,
    ...localItems.filter((l) => !serverItems.some((s) => s.id === l.id)),
  ];

  const handleRemove = (id: string) => {
    removeFromAnonGarage(id);
    setLocalItems((prev) => prev.filter((i) => i.id !== id));
    setServerItems((prev) => prev.filter((i) => i.id !== id));
  };

  const typeLabel = (type: AnonGarageItem["type"]) => {
    if (type === "receipt") return "Receipt";
    if (type === "fit_profile") return "EV Fit";
    return "Shortlist";
  };

  const typeColor = (type: AnonGarageItem["type"]) => {
    if (type === "receipt") return "bg-blue-500/15 text-blue-400";
    if (type === "fit_profile") return "bg-purple-500/15 text-purple-400";
    return "bg-[#00d97e]/15 text-[#00d97e]";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Saved Listings</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Vehicles and reports you&apos;ve bookmarked for review
          </p>
        </div>
        <button
          onClick={() => {
            setLocalItems(getAnonGarage().map(parseSavedItem));
            if (session?.access_token) {
              setLoading(true);
              fetch("/api/workspace/garage", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
                .then((r) => r.json())
                .then((data) => setServerItems((data.items || []).map(parseSavedItem)))
                .catch(() => {})
                .finally(() => setLoading(false));
            }
          }}
          className="p-2 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/[0.06] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {allItems.length === 0 ? (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-14 text-center">
          <Bookmark className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm font-medium">No saved listings yet</p>
          <p className="text-white/30 text-xs mt-1 mb-6 max-w-sm mx-auto">
            Bookmark vehicles from auction pages, receipt checks, or the EV fit tool to review them here.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/copart"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] border border-white/[0.10] text-white/60 rounded-lg text-sm hover:bg-white/[0.10] hover:text-white transition-colors"
            >
              <Package className="w-4 h-4" />
              Browse Copart
            </Link>
            <Link
              href="/receipt"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] border border-white/[0.10] text-white/60 rounded-lg text-sm hover:bg-white/[0.10] hover:text-white transition-colors"
            >
              <Car className="w-4 h-4" />
              Check a Receipt
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {allItems.map((item) => (
            <div
              key={item.id}
              className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 flex items-start gap-4 hover:bg-white/[0.06] transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                <Car className="w-5 h-5 text-white/30" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-white truncate">
                    {item.year ? `${item.year} ` : ""}
                    {item.make && item.model
                      ? `${item.make} ${item.model}`
                      : item.label}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor(item.type)}`}>
                    {typeLabel(item.type)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {item.vin && (
                    <span className="text-xs text-white/40 font-mono">{item.vin}</span>
                  )}
                  {item.price != null && (
                    <span className="text-xs text-white/50">${item.price.toLocaleString()}</span>
                  )}
                  {item.mileage != null && (
                    <span className="text-xs text-white/40">{item.mileage.toLocaleString()} mi</span>
                  )}
                  {item.source && (
                    <span className="text-xs text-white/30 capitalize">{item.source}</span>
                  )}
                </div>

                <p className="text-xs text-white/20 mt-1">
                  Saved {new Date(item.saved_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.url && (
                  <Link
                    href={item.url}
                    className="p-1.5 text-white/30 hover:text-blue-400 rounded transition-colors"
                    title="Open listing"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                )}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="p-1.5 text-white/30 hover:text-red-400 rounded transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {allItems.length > 0 && (
        <p className="text-xs text-white/20 text-center mt-6">
          {allItems.length} saved item{allItems.length !== 1 ? "s" : ""}
          {" · "}
          <Link href="/workspace/garage" className="hover:text-white/40 transition-colors">
            View full garage →
          </Link>
        </p>
      )}
    </div>
  );
}
