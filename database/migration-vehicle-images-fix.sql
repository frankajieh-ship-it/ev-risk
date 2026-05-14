-- Fix: replace functional unique index with plain unique constraint
-- so Supabase PostgREST onConflict upsert works correctly.
--
-- The TypeScript cacheSet() already lowercases make/model/trim before storing,
-- so a plain unique constraint on (make, model, year, coalesce(trim,'')) is equivalent
-- to the functional index on (lower(make), lower(model), year, lower(coalesce(trim,''))).

-- 1. Drop the functional index (cannot be used as onConflict target)
DROP INDEX IF EXISTS idx_vehicle_images_ymm;

-- 2. Add a plain unique constraint on the columns (values are already lowercased at insert)
--    Use a helper column for trim-coalesce: easiest is to store empty string instead of NULL for trim.
--    Since trim can be NULL, we use a unique index on a COALESCE expression but need to
--    make it a constraint-backing index via a unique index on a functional expression.
--    PostgREST supports this when you reference exact column names in onConflict.
--    Workaround: normalize trim to '' (empty string) instead of NULL so we can use plain unique.

-- Add unique constraint on (make, model, year, trim) where trim defaults to ''
-- We'll change NULLs to '' in the application layer (already done in cacheSet via normTrim).
-- But the column allows NULL, so we need a partial approach.

-- Best approach for PostgREST compatibility: use a unique constraint on columns directly.
-- Since trim can be NULL and NULL != NULL in unique constraints, we add a unique index
-- that treats NULL trim as empty string — then reference it via onConflict with a computed column.

-- Simplest working solution: store trim as '' (empty string) never NULL,
-- add a NOT NULL DEFAULT '' constraint, then plain UNIQUE (make, model, year, trim).

ALTER TABLE vehicle_images ALTER COLUMN trim SET DEFAULT '';
ALTER TABLE vehicle_images ALTER COLUMN trim SET NOT NULL;
UPDATE vehicle_images SET trim = '' WHERE trim IS NULL;

-- Now add the plain unique constraint
ALTER TABLE vehicle_images ADD CONSTRAINT uq_vehicle_images_ymm
  UNIQUE (make, model, year, trim);

-- Keep the VIN unique index (partial indexes work fine for lookups, just not onConflict)
-- But for upsert we need a constraint too:
DROP INDEX IF EXISTS idx_vehicle_images_vin;
ALTER TABLE vehicle_images ADD CONSTRAINT uq_vehicle_images_vin
  UNIQUE (vin);

-- Recreate expires index (non-unique, fine as-is)
CREATE INDEX IF NOT EXISTS idx_vehicle_images_expires
  ON vehicle_images (expires_at);
