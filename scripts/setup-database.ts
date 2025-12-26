/**
 * Database Setup Script
 *
 * Run this to create the reports table in Vercel Postgres
 *
 * Usage:
 *   npx tsx scripts/setup-database.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

async function setupDatabase() {
  try {
    console.log("🔧 Setting up database...");

    // Create reports table
    await sql`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status TEXT NOT NULL CHECK (status IN ('draft', 'paid', 'free')),
        payload_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        stripe_session_id TEXT,
        customer_email TEXT,
        vehicle_year INTEGER,
        vehicle_model TEXT,
        is_free BOOLEAN DEFAULT FALSE
      );
    `;
    console.log("✅ Created reports table");

    // Create feedback table
    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES reports(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        would_recommend BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    console.log("✅ Created feedback table");

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);`;
    console.log("✅ Created status index");

    await sql`CREATE INDEX IF NOT EXISTS idx_reports_stripe_session ON reports(stripe_session_id);`;
    console.log("✅ Created stripe_session_id index");

    await sql`CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);`;
    console.log("✅ Created created_at index");

    console.log("\n✅ Database setup complete!");
    console.log("\nYou can now:");
    console.log("  1. Run the dev server: npm run dev");
    console.log("  2. Test the payment flow");
    console.log("  3. Reports will be stored in Neon Postgres\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
