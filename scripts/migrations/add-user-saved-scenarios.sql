-- User Saved Scenarios Migration
-- Adds user authentication support and scenario saving functionality

-- 1. Users table (extends Supabase Auth)
-- Supabase Auth already manages auth.users, but we need a public profile table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  scenarios_saved INTEGER NOT NULL DEFAULT 0,
  -- Preferences
  preferred_region TEXT DEFAULT 'AUTO',
  email_notifications BOOLEAN DEFAULT true
);

-- 2. Saved scenarios table
CREATE TABLE IF NOT EXISTS saved_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES evroutine_sessions(id) ON DELETE SET NULL,

  -- Scenario snapshot (denormalized for quick access)
  scenario_hash TEXT NOT NULL, -- fingerprint from scenario-fingerprint.ts
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  fit_signal TEXT, -- GOOD | CONDITIONAL | HIGH_FRICTION
  one_sentence_verdict TEXT,

  -- Input snapshot
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ,
  notes TEXT, -- User's personal notes

  -- Comparison flag
  is_comparison BOOLEAN DEFAULT false,
  comparison_data JSONB -- For A vs B comparisons
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_user_id ON saved_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_hash ON saved_scenarios(scenario_hash);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_saved_at ON saved_scenarios(saved_at DESC);

-- 4. Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Increment scenarios_saved trigger
CREATE OR REPLACE FUNCTION increment_scenarios_saved()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET scenarios_saved = scenarios_saved + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_scenario_saved
  AFTER INSERT ON saved_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION increment_scenarios_saved();

-- 6. Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_scenarios ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can only access their own saved scenarios
CREATE POLICY "Users can view own scenarios" ON saved_scenarios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenarios" ON saved_scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenarios" ON saved_scenarios
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Function to create user profile on signup (called by Supabase Auth trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
