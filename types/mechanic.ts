// ── Mechanic marketplace shared types ─────────────────────────────────────

export type ServiceType =
  | "pre_purchase"
  | "ev_inspection"
  | "salvage_assessment"
  | "ev_battery"
  | "body_repair"
  | "alignment"
  | "electrical"
  | "general_repair"
  | "oil_change";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  pre_purchase:      "Pre-Purchase Inspection",
  ev_inspection:     "EV Inspection",
  salvage_assessment:"Salvage Assessment",
  ev_battery:        "EV Battery Diagnostic",
  body_repair:       "Body Repair",
  alignment:         "Alignment",
  electrical:        "Electrical Diagnosis",
  general_repair:    "General Repair",
  oil_change:        "Oil Change / Service",
};

export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  pre_purchase:       "🔍",
  ev_inspection:      "⚡",
  salvage_assessment: "🔧",
  ev_battery:         "🔋",
  body_repair:        "🚗",
  alignment:          "📐",
  electrical:         "💡",
  general_repair:     "🛠️",
  oil_change:         "🛢️",
};

export type PriceType = "fixed" | "starting_at" | "quote";
export type QuoteStatus = "pending" | "accepted" | "declined" | "expired";
export type RequestStatus = "open" | "quoted" | "accepted" | "in_progress" | "completed" | "cancelled";

export interface MechanicService {
  id: string;
  service_type: ServiceType;
  name: string;
  description?: string;
  price_cents?: number;
  price_type: PriceType;
  duration_hours?: number;
}

export interface MechanicProfile {
  id: string;
  slug: string;
  business_name: string;
  bio?: string;
  phone?: string;
  email: string;
  website?: string;
  city: string;
  state: string;
  zip: string;
  photo_url?: string;
  cover_photo_url?: string;
  specialties: ServiceType[];
  certifications: string[];
  service_radius_miles: number;
  accepts_new_clients: boolean;
  avg_rating?: number;
  review_count: number;
  response_rate: number;
  is_verified: boolean;
  is_featured: boolean;
  services?: MechanicService[];
  distance_miles?: number;       // populated by search endpoint
  match_score?: number;          // composite ranking score
}

export interface ServiceQuote {
  id: string;
  mechanic_id: string;
  mechanic?: Pick<MechanicProfile, "slug" | "business_name" | "photo_url" | "avg_rating" | "review_count">;
  price_cents: number;
  notes?: string;
  available_date?: string;
  expires_at: string;
  status: QuoteStatus;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  vehicle_vin?: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  auction_result_id?: string;
  service_type: ServiceType;
  description: string;
  preferred_date?: string;
  zip: string;
  status: RequestStatus;
  quotes?: ServiceQuote[];
  created_at: string;
}

export interface MechanicReview {
  id: string;
  mechanic_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
  is_verified: boolean;
  created_at: string;
  reviewer_name?: string;        // de-identified first name + last initial
}
