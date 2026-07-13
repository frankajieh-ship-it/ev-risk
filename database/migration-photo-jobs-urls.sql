-- Migration: add photo_urls to receipt_photo_jobs so the background function
-- can read URLs from DB instead of receiving them in a large HTTP POST body.
ALTER TABLE receipt_photo_jobs
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
