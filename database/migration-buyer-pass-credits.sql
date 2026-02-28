-- Migration: Add receipt credit columns to purchases table
-- Required for Buyer Pass ($9.99) — 10 receipt credits per purchase
--
-- Run this in the Supabase SQL Editor before deploying the Buyer Pass update.

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receipt_credits_total INT NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receipt_credits_used INT NOT NULL DEFAULT 0;
