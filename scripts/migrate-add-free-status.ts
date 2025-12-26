/**
 * Migration: Add free status support
 *
 * This adds the is_free column and updates the status constraint
 * to allow 'free' as a valid status.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-free-status.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

async function migrate() {
  try {
    console.log("🔧 Running migration: Add free status support...");

    // Add is_free column if it doesn't exist
    await sql`
      ALTER TABLE reports
      ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT FALSE;
    `;
    console.log("✅ Added is_free column");

    // Drop the old constraint
    await sql`
      ALTER TABLE reports
      DROP CONSTRAINT IF EXISTS reports_status_check;
    `;
    console.log("✅ Dropped old status constraint");

    // Add new constraint with 'free' status
    await sql`
      ALTER TABLE reports
      ADD CONSTRAINT reports_status_check
      CHECK (status IN ('draft', 'paid', 'free'));
    `;
    console.log("✅ Added new status constraint with 'free'");

    console.log("\n✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
