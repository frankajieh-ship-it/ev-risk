/**
 * Verify user_events table exists
 * Run with: node scripts/verify-events-table.js
 */

import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifyTable() {
  try {
    console.log('Checking if user_events table exists...\n');

    // Check table exists
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'user_events';
    `;

    if (tables.rows.length > 0) {
      console.log('✅ user_events table EXISTS');

      // Get column info
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'user_events'
        ORDER BY ordinal_position;
      `;

      console.log('\nTable columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Get indexes
      const indexes = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'user_events';
      `;

      console.log('\nIndexes:');
      indexes.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });

      console.log('\n✅ Migration successful! Event tracking is ready to use.');
    } else {
      console.log('❌ user_events table does NOT exist');
      console.log('Run: node scripts/migrate-events-table.js');
    }
  } catch (error) {
    console.error('Verification error:', error);
    process.exit(1);
  }
}

verifyTable();
