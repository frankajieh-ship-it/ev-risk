-- ── Mechanic Marketplace Schema ────────────────────────────────────────────
-- Run this migration in Supabase SQL Editor.
-- Mirrors the dealer schema pattern (dealerships, dealer_members, inquiries).

-- 1. MECHANIC PROFILES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mechanic_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT UNIQUE NOT NULL,
  business_name        TEXT NOT NULL,
  bio                  TEXT,
  phone                TEXT,
  website              TEXT,
  address_line1        TEXT,
  city                 TEXT NOT NULL,
  state                TEXT NOT NULL,
  zip                  TEXT NOT NULL,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  service_radius_miles INT DEFAULT 50,
  specialties          TEXT[] NOT NULL DEFAULT '{}',
  certifications       TEXT[] DEFAULT '{}',
  cover_photo_url      TEXT,
  avatar_url           TEXT,
  is_verified          BOOLEAN DEFAULT false,
  is_featured          BOOLEAN DEFAULT false,
  avg_rating           DOUBLE PRECISION DEFAULT 0,
  review_count         INT DEFAULT 0,
  response_rate        INT DEFAULT 0,            -- percentage 0-100
  accepts_new_clients  BOOLEAN DEFAULT true,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  contact_email        TEXT,
  rejection_reason     TEXT,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_slug    ON mechanic_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_zip     ON mechanic_profiles(zip);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_state   ON mechanic_profiles(state);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_status  ON mechanic_profiles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_verified ON mechanic_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_mechanic_profiles_specialties ON mechanic_profiles USING GIN(specialties);

-- 2. MECHANIC MEMBERS ────────────────────────────────────────────────────────
-- Links auth users to mechanic profiles (same pattern as dealer_members).
CREATE TABLE IF NOT EXISTS mechanic_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  mechanic_id  UUID NOT NULL REFERENCES mechanic_profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_members_user     ON mechanic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_members_mechanic ON mechanic_members(mechanic_id);

-- 3. SERVICE REQUESTS ────────────────────────────────────────────────────────
-- A buyer requests a service from a mechanic (anonymous or authenticated).
CREATE TABLE IF NOT EXISTS service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id       UUID NOT NULL REFERENCES mechanic_profiles(id),
  buyer_user_id     UUID REFERENCES auth.users(id),    -- null if anonymous
  auction_result_id TEXT,                              -- links to auction_results
  vin               TEXT,
  year              INT,
  make              TEXT,
  model             TEXT,
  service_type      TEXT NOT NULL,
  preferred_date    DATE,
  notes             TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  zip               TEXT,
  status            TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending', 'quoted', 'accepted', 'declined', 'completed')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_mechanic ON service_requests(mechanic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_buyer   ON service_requests(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status  ON service_requests(status);

-- 4. MECHANIC REVIEWS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mechanic_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id         UUID NOT NULL REFERENCES mechanic_profiles(id),
  reviewer_user_id    UUID REFERENCES auth.users(id),
  service_request_id  UUID REFERENCES service_requests(id),
  rating              INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT,
  service_type        TEXT,
  verified_service    BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mechanic_reviews_mechanic ON mechanic_reviews(mechanic_id, created_at DESC);

-- 5. AUTO-UPDATE updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_mechanic_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mechanic_profiles_updated_at ON mechanic_profiles;
CREATE TRIGGER trg_mechanic_profiles_updated_at
  BEFORE UPDATE ON mechanic_profiles
  FOR EACH ROW EXECUTE FUNCTION update_mechanic_updated_at();

DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON service_requests;
CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_mechanic_updated_at();
