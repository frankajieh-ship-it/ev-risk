/**
 * Drop and recreate feedback table with new schema
 * WARNING: This will delete all existing feedback data
 * Run: node scripts/recreate-feedback-table.js
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as readline from 'readline/promises';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function recreate() {
  try {
    console.log('⚠️  WARNING: This will DROP the existing feedback table and all its data!\n');

    // Confirm with user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await rl.question('Are you sure you want to continue? (yes/no): ');
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Aborted');
      return;
    }

    console.log('\n🗑️  Dropping old feedback table...');
    await sql`DROP TABLE IF EXISTS feedback CASCADE`;
    console.log('✓ Old table dropped');

    console.log('\n📝 Creating new feedback table...');
    await sql`
      CREATE TABLE feedback (
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

    console.log('\n📊 Creating indexes...');
    await sql`CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC)`;
    console.log('✓ Created created_at index');

    await sql`CREATE INDEX idx_feedback_type ON feedback(feedback_type)`;
    console.log('✓ Created feedback_type index');

    await sql`COMMENT ON TABLE feedback IS 'User feedback submissions for EV-Risk application improvements'`;
    console.log('✓ Added table comment');

    console.log('\n✅ Feedback table recreated successfully!');
    console.log('\nNew table structure:');
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
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

recreate();
