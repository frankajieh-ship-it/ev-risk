/**
 * Dealer Directory Page — OFFOLab dark design
 *
 * Public searchable directory of EV-friendly dealerships.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin, Shield, Loader2, Building, ArrowLeft, ChevronRight, Car, Sparkles } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import Header from "@/components/landing/Header";

interface DealerListing {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  is_verified: boolean;
  ev_specialties: string[] | null;
  logo_url: string | null;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function DealerDirectoryPage() {
  const [dealers, setDealers] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [total, setTotal] = useState(0);
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    trackEvent("dealer_directory_viewed");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (state) params.set("state", state);

    fetch(`/api/dealers?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDealers(data.dealers);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, state]);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OFFO
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 bg-[#00d97e]/10 rounded-full border border-[#00d97e]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider">EV-Friendly Dealers</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Dealer Directory</h1>
          <p className="text-sm text-white/40 mt-1">Find EV-friendly dealers near you</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search by dealer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-[#161b22] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/40 outline-none transition-colors"
            />
          </div>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="px-3 py-2.5 bg-[#161b22] border border-white/[0.08] rounded-xl text-sm text-white/70 focus:ring-2 focus:ring-[#00d97e]/40 outline-none transition-colors"
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Browse vehicles CTA */}
        <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/80">Looking to buy?</p>
            <p className="text-xs text-white/40 mt-0.5">Browse EV inventory across all listed dealers.</p>
          </div>
          <Link
            href="/deals"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/30 transition-colors"
          >
            <Car className="w-4 h-4" />
            Browse all vehicles →
          </Link>
        </div>

        {/* Dealer CTA */}
        <div className="mb-6 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/80">Are you a dealer?</p>
            <p className="text-xs text-white/40 mt-0.5">List your inventory and reach high-intent EV buyers.</p>
          </div>
          <Link
            href="/dealers/join"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold hover:bg-[#00c970] transition-colors"
          >
            List your dealership
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
          </div>
        ) : dealers.length === 0 ? (
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-12 text-center">
            <Building className="w-12 h-12 mx-auto text-white/10 mb-3" />
            <p className="text-white/50 font-medium">No dealers found</p>
            <p className="text-sm text-white/30 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-white/30 mb-3">{total} dealer{total !== 1 ? "s" : ""} found</p>
            <div className="space-y-3">
              {dealers.map((d) => (
                <Link
                  key={d.id}
                  href={`/dealers/${d.slug}`}
                  onClick={() => trackEvent("dealer_directory_card_clicked", { dealer_id: d.id, dealer_name: d.name, dealer_slug: d.slug })}
                  className="flex items-start gap-4 bg-[#161b22] rounded-2xl border border-white/[0.08] p-4 hover:border-white/[0.18] hover:bg-white/[0.03] transition-all"
                >
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
                    {d.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <Building className="w-6 h-6 text-white/20" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white/90">{d.name}</h3>
                      {d.is_verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#00d97e] bg-[#00d97e]/10 border border-[#00d97e]/20 px-1.5 py-0.5 rounded-full">
                          <Shield className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    {(d.city || d.state) && (
                      <p className="text-sm text-white/40 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {[d.city, d.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {d.description && (
                      <p className="text-sm text-white/30 mt-1 line-clamp-2">{d.description}</p>
                    )}
                    {d.ev_specialties && d.ev_specialties.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {d.ev_specialties.map((s) => (
                          <span key={s} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
