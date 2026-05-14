-- Questionnaire v2 — buyer context fields for routine_profiles
-- Run via Supabase SQL editor or psql

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS ev_experience TEXT
  CHECK (ev_experience IN ('first_time', 'experienced', 'researching'));

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS vehicle_condition TEXT
  CHECK (vehicle_condition IN ('new', 'used', 'any'));

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS has_backup_vehicle TEXT
  CHECK (has_backup_vehicle IN ('yes_daily', 'yes_rarely', 'no'));

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS ownership_timeline TEXT
  CHECK (ownership_timeline IN ('lease_1_3', 'medium_3_5', 'long_5_plus'));

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS charging_stop_tolerance TEXT
  CHECK (charging_stop_tolerance IN ('ok', 'prefer_limit', 'rather_not'));

ALTER TABLE routine_profiles ADD COLUMN IF NOT EXISTS priority_weights TEXT[];

COMMENT ON COLUMN routine_profiles.ev_experience IS 'first_time | experienced | researching — from questionnaire v2 filter panel';
COMMENT ON COLUMN routine_profiles.vehicle_condition IS 'new | used | any — buyer preference for new vs certified pre-owned';
COMMENT ON COLUMN routine_profiles.has_backup_vehicle IS 'yes_daily | yes_rarely | no — affects recovery resilience scoring';
COMMENT ON COLUMN routine_profiles.ownership_timeline IS 'lease_1_3 | medium_3_5 | long_5_plus — boosts reliability weight at long_5_plus';
COMMENT ON COLUMN routine_profiles.charging_stop_tolerance IS 'ok | prefer_limit | rather_not — penalizes recovery score when rather_not + weekly long days';
COMMENT ON COLUMN routine_profiles.priority_weights IS 'Ordered array of up to 3 user priorities: range | charging | cost | reliability | interior | tech';
