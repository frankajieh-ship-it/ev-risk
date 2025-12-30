/**
 * Complete migration script for all tracking tables
 * Run with: node scripts/migrate-all-tables.js
 */

import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function migrateAllTables() {
  try {
    console.log('Starting database migration...\n');

    // Create visitors table
    console.log('1. Creating visitors table...');
    await sql`
      CREATE TABLE IF NOT EXISTS visitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        referrer TEXT,
        page_path TEXT,
        country TEXT,
        city TEXT,
        first_visit TIMESTAMP DEFAULT NOW(),
        last_visit TIMESTAMP DEFAULT NOW(),
        visit_count INTEGER DEFAULT 1,
        session_count INTEGER DEFAULT 1
      );
    `;
    console.log('✓ visitors table created');

    // Create indexes for visitors
    await sql`CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON visitors(visitor_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_visitors_first_visit ON visitors(first_visit DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON visitors(last_visit DESC);`;
    console.log('✓ visitors indexes created');

    // Create page_views table
    console.log('\n2. Creating page_views table...');
    await sql`
      CREATE TABLE IF NOT EXISTS page_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id TEXT NOT NULL,
        page_path TEXT NOT NULL,
        referrer TEXT,
        timestamp TIMESTAMP DEFAULT NOW(),
        session_duration INTEGER
      );
    `;
    console.log('✓ page_views table created');

    // Create indexes for page_views
    await sql`CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);`;
    console.log('✓ page_views indexes created');

    // Create user_events table
    console.log('\n3. Creating user_events table...');
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

    // Create indexes for user_events
    await sql`CREATE INDEX IF NOT EXISTS idx_events_name ON user_events(event_name);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_visitor ON user_events(visitor_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON user_events(timestamp DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_data ON user_events USING GIN (event_data);`;
    console.log('✓ user_events indexes created');

    // Verify all tables exist
    console.log('\n4. Verifying tables...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('visitors', 'page_views', 'user_events')
      ORDER BY table_name;
    `;

    console.log('\nCreated tables:');
    tables.rows.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });

    if (tables.rows.length === 3) {
      console.log('\n✅ Migration successful! All tracking tables are ready.');
    } else {
      console.log(`\n⚠️  Only ${tables.rows.length}/3 tables created. Check for errors above.`);
    }
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

migrateAllTables();
