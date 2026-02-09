/**
 * Migrate data from Neon Postgres (old Vercel backend) to Supabase
 *
 * Usage:
 *   npx tsx scripts/migrate-neon-to-supabase.ts
 *
 * Prerequisites:
 *   1. Run supabase-ensure-tables.sql against Supabase first
 *   2. Set environment variables in .env.local:
 *      - DATABASE_URL (Neon connection string — already present)
 *      - NEXT_PUBLIC_SUPABASE_URL (already present)
 *      - SUPABASE_SERVICE_ROLE_KEY (already present)
 *
 * What this does:
 *   - Reads all rows from Neon Postgres tables: reports, visitors, page_views,
 *     user_events, report_feedback
 *   - Inserts them into Supabase (skipping duplicates by id)
 *   - Prints a summary of migrated rows
 */

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

// Load env from .env.local
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const NEON_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEON_URL) {
  console.error("Missing DATABASE_URL (Neon connection string)");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const neon = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface MigrationResult {
  table: string;
  neonCount: number;
  inserted: number;
  skipped: number;
  errors: number;
}

const BATCH_SIZE = 100;

async function migrateTable(
  tableName: string,
  idColumn: string = "id"
): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: tableName,
    neonCount: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Check if table exists in Neon
    const tableCheck = await neon.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
      [tableName]
    );
    if (!tableCheck.rows[0].exists) {
      console.log(`  [SKIP] Table "${tableName}" does not exist in Neon`);
      return result;
    }

    // Count rows in Neon
    const countResult = await neon.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    result.neonCount = parseInt(countResult.rows[0].count, 10);
    console.log(`  Found ${result.neonCount} rows in Neon "${tableName}"`);

    if (result.neonCount === 0) return result;

    // Get existing IDs in Supabase to skip duplicates
    const { data: existingRows } = await supabase
      .from(tableName)
      .select(idColumn);
    const existingIds = new Set((existingRows || []).map((r: any) => r[idColumn]));
    console.log(`  ${existingIds.size} rows already exist in Supabase "${tableName}"`);

    // Fetch all rows from Neon
    const allRows = await neon.query(`SELECT * FROM ${tableName} ORDER BY ${
      tableName === "visitors" ? "first_visit" :
      tableName === "page_views" ? "timestamp" :
      tableName === "user_events" ? "timestamp" :
      "created_at"
    } ASC`);

    // Filter out duplicates
    const newRows = allRows.rows.filter((row: any) => !existingIds.has(row[idColumn]));
    result.skipped = allRows.rows.length - newRows.length;
    console.log(`  ${newRows.length} new rows to migrate, ${result.skipped} duplicates skipped`);

    // Insert in batches
    for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
      const batch = newRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from(tableName).insert(batch);

      if (error) {
        console.error(`  [ERROR] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        // Try inserting one by one for this batch
        for (const row of batch) {
          const { error: singleError } = await supabase.from(tableName).insert(row);
          if (singleError) {
            result.errors++;
            // Only log first few errors to avoid spam
            if (result.errors <= 5) {
              console.error(`    Row ${row[idColumn]}: ${singleError.message}`);
            }
          } else {
            result.inserted++;
          }
        }
      } else {
        result.inserted += batch.length;
      }

      // Progress
      const progress = Math.min(i + BATCH_SIZE, newRows.length);
      if (progress % 500 === 0 || progress === newRows.length) {
        console.log(`  Progress: ${progress}/${newRows.length}`);
      }
    }
  } catch (err: any) {
    console.error(`  [ERROR] Table "${tableName}": ${err.message}`);
    result.errors++;
  }

  return result;
}

async function main() {
  console.log("=== Neon → Supabase Migration ===\n");
  console.log(`Neon:     ${NEON_URL?.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  // Connect to Neon
  try {
    await neon.connect();
    console.log("[OK] Connected to Neon Postgres\n");
  } catch (err: any) {
    console.error(`[FAIL] Cannot connect to Neon: ${err.message}`);
    console.error("The old Neon database may have been deleted. Check your Neon dashboard.");
    process.exit(1);
  }

  // Migrate tables in order (respecting foreign keys)
  const tables = ["reports", "visitors", "page_views", "user_events", "report_feedback"];
  const results: MigrationResult[] = [];

  for (const table of tables) {
    console.log(`\nMigrating "${table}"...`);
    const result = await migrateTable(table);
    results.push(result);
  }

  // Summary
  console.log("\n=== Migration Summary ===\n");
  console.log("Table            | Neon   | Inserted | Skipped | Errors");
  console.log("-----------------|--------|----------|---------|-------");
  for (const r of results) {
    console.log(
      `${r.table.padEnd(17)}| ${String(r.neonCount).padStart(6)} | ${String(r.inserted).padStart(8)} | ${String(r.skipped).padStart(7)} | ${String(r.errors).padStart(6)}`
    );
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  console.log(`\nTotal: ${totalInserted} rows inserted, ${totalErrors} errors`);

  if (totalErrors > 0) {
    console.log("\nSome rows failed to migrate. Review errors above.");
    console.log("Common causes: schema mismatch, RLS policies, or constraint violations.");
  }

  await neon.end();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
