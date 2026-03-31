-- Migration: garage_vehicle_reviews
-- Adds per-user star rating + optional review text + tags to saved garage vehicles.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS garage_vehicle_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_vehicle_id UUID NOT NULL REFERENCES garage_vehicles(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text       TEXT,
  tags              TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(garage_vehicle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_garage_vehicle_reviews_vehicle
  ON garage_vehicle_reviews(garage_vehicle_id);

ALTER TABLE garage_vehicle_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reviews"
  ON garage_vehicle_reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
