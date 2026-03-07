/**
 * Dealer Directory Page
 *
 * Public searchable directory of EV-friendly dealerships.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin, Shield, Loader2, Building, ArrowLeft } from "lucide-react";

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

export default function DealerDirectoryPage() {
  const [dealers, setDealers] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [total, setTotal] = useState(0);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to OFFO
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Dealer Directory</h1>
          <p className="text-sm text-gray-500 mt-1">Find EV-friendly dealers near you</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by dealer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All States</option>
            {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : dealers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No dealers found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">{total} dealer{total !== 1 ? "s" : ""} found</p>
            <div className="space-y-3">
              {dealers.map((d) => (
                <Link
                  key={d.id}
                  href={`/dealers/${d.slug}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      {d.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <Building className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{d.name}</h3>
                        {d.is_verified && (
                          <span className="flex items-center gap-0.5 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                            <Shield className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </div>
                      {(d.city || d.state) && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {[d.city, d.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {d.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{d.description}</p>
                      )}
                      {d.ev_specialties && d.ev_specialties.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {d.ev_specialties.map((s) => (
                            <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
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
