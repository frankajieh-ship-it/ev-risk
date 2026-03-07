-- B2B Foundation: Buyer-Dealer Connection Platform
-- Creates tables for dealerships, dealer members, buyer garage,
-- dealer inventory, inquiries, and inquiry messages.

-- 1. Dealerships
CREATE TABLE IF NOT EXISTS dealerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  is_verified BOOLEAN DEFAULT false,
  ev_specialties TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealerships_slug ON dealerships(slug);
CREATE INDEX IF NOT EXISTS idx_dealerships_state ON dealerships(state);
CREATE INDEX IF NOT EXISTS idx_dealerships_verified ON dealerships(is_verified);

-- 2. Dealer members (links auth users to dealerships)
CREATE TABLE IF NOT EXISTS dealer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dealership_id)
);

CREATE INDEX IF NOT EXISTS idx_dealer_members_user ON dealer_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dealer_members_dealership ON dealer_members(dealership_id);

-- 3. Buyer garage (saved vehicles with decoded data)
CREATE TABLE IF NOT EXISTS garage_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vin TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  trim TEXT,
  nickname TEXT,
  classification JSONB,
  offo_rating JSONB,
  receipt_id UUID REFERENCES receipts(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_garage_vehicles_user ON garage_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_garage_vehicles_vin ON garage_vehicles(vin) WHERE vin IS NOT NULL;

-- 4. Dealer inventory
CREATE TABLE IF NOT EXISTS dealer_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  vin TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  trim TEXT,
  price_cents INT,
  mileage INT,
  exterior_color TEXT,
  listing_url TEXT,
  photo_urls TEXT[],
  classification JSONB,
  offo_rating JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'pending', 'removed')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'api')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealer_inventory_dealership ON dealer_inventory(dealership_id);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_status ON dealer_inventory(status);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_make_model ON dealer_inventory(make, model);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_vin ON dealer_inventory(vin) WHERE vin IS NOT NULL;

-- 5. Buyer inquiries (connection layer)
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id),
  dealership_id UUID NOT NULL REFERENCES dealerships(id),
  inventory_item_id UUID REFERENCES dealer_inventory(id),
  garage_vehicle_id UUID REFERENCES garage_vehicles(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  inquiry_type TEXT DEFAULT 'general' CHECK (inquiry_type IN ('general', 'trade_in', 'test_drive', 'price_check')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'read', 'replied', 'closed')),
  offo_context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_buyer ON inquiries(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_dealership ON inquiries(dealership_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

-- 6. Inquiry messages (threaded conversation)
CREATE TABLE IF NOT EXISTS inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'dealer')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry ON inquiry_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_created ON inquiry_messages(inquiry_id, created_at);
