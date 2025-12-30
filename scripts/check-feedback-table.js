/**
 * Check existing feedback table structure
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkTable() {
  try {
    console.log('🔍 Checking existing feedback table structure...\n');

    // Get table columns
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'feedback'
      ORDER BY ordinal_position
    `;

    if (columns.length === 0) {
      console.log('❌ Feedback table does not exist');
      return;
    }

    console.log('📋 Current table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    console.log('\n🗑️  To drop and recreate, run:');
    console.log('   node scripts/recreate-feedback-table.js');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTable();
