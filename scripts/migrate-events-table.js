/**
 * Migration script to create user_events table
 * Run with: node scripts/migrate-events-table.js
 */

import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function migrateEventsTable() {
  try {
    console.log('Creating user_events table...');

    // Create user_events table
    await sql`
      CREATE TABLE IF NOT EXISTS user_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name TEXT NOT NULL,
        event_data JSONB,
        visitor_id TEXT NOT NULL,
        session_id TEXT,
        page_path TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log('✓ user_events table created');

    // Create indexes
    console.log('Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS idx_events_name ON user_events(event_name);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_visitor ON user_events(visitor_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON user_events(timestamp DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_data ON user_events USING GIN (event_data);`;

    console.log('✓ All indexes created');

    // Verify table exists
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'user_events';
    `;

    if (result.length > 0) {
      console.log('\n✅ Migration successful! user_events table is ready.');
    } else {
      console.log('\n❌ Migration failed. Table was not created.');
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateEventsTable();
