/**
 * Dealer Profile Page
 *
 * Public profile for a single dealer with description, inventory preview,
 * and inquiry button.
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building, MapPin, Globe, Phone, Shield,
  Car, Loader2, MessageSquare, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";

interface DealerProfile {
  id: string;
  name: string;
  slug: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  is_verified: boolean;
  ev_specialties: string[] | null;
  logo_url: string | null;
  inventory_count: number;
}

interface InventoryItem {
  id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  price_cents: number | null;
  mileage: number | null;
  classification: { category?: string } | null;
}

export default function DealerProfilePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Inquiry modal
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ subject: "", message: "", type: "general" });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const { session } = useAuth();
  const { trackOffoDealerViewed, trackOffoDealerMessageSent, getPersistentSessionId } = useEventTracking();

  useEffect(() => {
    if (!params.slug) return;

    Promise.all([
      fetch(`/api/dealers/${params.slug}`).then((r) => r.json()),
      fetch(`/api/dealers/${params.slug}/inventory?limit=6`).then((r) => r.json()),
    ])
      .then(([dealerRes, invRes]) => {
        if (dealerRes.success) {
          setDealer(dealerRes.dealer);
          trackOffoDealerViewed({
            dealer_id: dealerRes.dealer.id,
            dealer_name: dealerRes.dealer.name,
            viewed_from: "dealer_directory",
            session_id: getPersistentSessionId(),
          });
        }
        if (invRes.success) setInventory(invRes.inventory);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const handleSendInquiry = async () => {
    if (!dealer || !session?.access_token) return;
    setInquirySubmitting(true);

    try {
      const res = await fetch("/api/workspace/inquiries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealership_id: dealer.id,
          subject: inquiryForm.subject,
          message: inquiryForm.message,
          inquiry_type: inquiryForm.type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInquirySent(true);
        trackOffoDealerMessageSent({
          dealer_id: dealer.id,
          dealer_name: dealer.name,
          message_length_chars: inquiryForm.message.length,
          included_vehicle_context: false,
          message_sent_from: "dealer_page",
          session_id: getPersistentSessionId(),
        });
      }
    } catch {} finally {
      setInquirySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dealer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 font-medium">Dealer not found</p>
          <Link href="/dealers" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            Back to directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/dealers" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to directory
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              {dealer.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dealer.logo_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <Building className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{dealer.name}</h1>
                {dealer.is_verified && (
                  <span className="flex items-center gap-0.5 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    <Shield className="w-3 h-3" /> OFFO Verified
                  </span>
                )}
              </div>

              {(dealer.city || dealer.state) && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {[dealer.address_line1, dealer.city, dealer.state, dealer.zip].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="flex items-center gap-4 mt-2">
                {dealer.phone && (
                  <a href={`tel:${dealer.phone}`} className="text-sm text-gray-600 flex items-center gap-1 hover:text-blue-600">
                    <Phone className="w-3.5 h-3.5" /> {dealer.phone}
                  </a>
                )}
                {dealer.website && (
                  <a href={dealer.website} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 flex items-center gap-1 hover:text-blue-600">
                    <Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  router.push(`/auth/login?redirect=/dealers/${dealer.slug}`);
                  return;
                }
                setShowInquiry(true);
              }}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Contact Dealer
            </button>
          </div>

          {dealer.description && (
            <p className="text-sm text-gray-600 mt-4 leading-relaxed">{dealer.description}</p>
          )}

          {dealer.ev_specialties && dealer.ev_specialties.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {dealer.ev_specialties.map((s) => (
                <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-800">Inventory</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {dealer.inventory_count}
              </span>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-sm">No inventory listed yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {inventory.map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="font-medium text-sm text-gray-800">
                    {item.year || ""} {item.make} {item.model}
                  </p>
                  {item.trim && <p className="text-xs text-gray-400">{item.trim}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {item.price_cents != null && (
                      <span className="text-sm font-semibold text-gray-900">
                        ${(item.price_cents / 100).toLocaleString()}
                      </span>
                    )}
                    {item.mileage != null && (
                      <span className="text-xs text-gray-400">{item.mileage.toLocaleString()} mi</span>
                    )}
                    {item.classification?.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.classification.category === "EV" ? "bg-green-50 text-green-700" :
                        item.classification.category === "PHEV" ? "bg-yellow-50 text-yellow-700" :
                        "bg-gray-50 text-gray-500"
                      }`}>
                        {item.classification.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inquiry Modal */}
        {showInquiry && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
              {inquirySent ? (
                <div className="text-center py-4">
                  <MessageSquare className="w-10 h-10 mx-auto text-green-500 mb-3" />
                  <h3 className="font-semibold text-gray-900">Inquiry Sent</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {dealer.name} will receive your message. Check your inquiries for updates.
                  </p>
                  <button
                    onClick={() => { setShowInquiry(false); setInquirySent(false); }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-900 mb-4">Contact {dealer.name}</h3>

                  <select
                    value={inquiryForm.type}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">General Inquiry</option>
                    <option value="test_drive">Schedule Test Drive</option>
                    <option value="price_check">Price Check</option>
                    <option value="trade_in">Trade-In</option>
                  </select>

                  <input
                    placeholder="Subject"
                    value={inquiryForm.subject}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <textarea
                    placeholder="Your message..."
                    rows={4}
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowInquiry(false)}
                      className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendInquiry}
                      disabled={inquirySubmitting || !inquiryForm.subject || !inquiryForm.message}
                      className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {inquirySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
