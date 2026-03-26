-- Migration: recall extras
-- Adds last_recall_check timestamp to garage_vehicles for tracking when each vehicle was last scanned.

ALTER TABLE garage_vehicles
ADD COLUMN IF NOT EXISTS last_recall_check timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_garage_vehicles_recall_check
  ON garage_vehicles(last_recall_check);
