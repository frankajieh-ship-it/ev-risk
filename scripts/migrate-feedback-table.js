/**
 * Migration script to create feedback table
 * Run: node scripts/migrate-feedback-table.js
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('🔄 Starting feedback table migration...\n');

    // Read SQL file
    const sqlPath = join(__dirname, 'create-feedback-table.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    // Execute SQL statements one by one
    console.log('📝 Executing SQL...\n');

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255),
        feedback_type VARCHAR(50) NOT NULL,
        helpful TEXT,
        missing TEXT,
        additional_data TEXT,
        comments TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        ip_address VARCHAR(45)
      )
    `;
    console.log('✓ Created feedback table');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)`;
    console.log('✓ Created created_at index');

    await sql`CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type)`;
    console.log('✓ Created feedback_type index');

    await sql`COMMENT ON TABLE feedback IS 'User feedback submissions for EV-Risk application improvements'`;
    console.log('✓ Added table comment');

    console.log('✅ Feedback table created successfully!');
    console.log('\nTable structure:');
    console.log('  - id (UUID, primary key)');
    console.log('  - email (optional)');
    console.log('  - feedback_type (general, bug, feature, accuracy, ux)');
    console.log('  - helpful (text)');
    console.log('  - missing (text)');
    console.log('  - additional_data (text)');
    console.log('  - comments (text)');
    console.log('  - created_at (timestamp)');
    console.log('  - user_agent (text)');
    console.log('  - ip_address (varchar)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
