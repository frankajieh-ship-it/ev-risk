/**
 * Create report_feedback table for report-specific feedback
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('🔄 Creating report_feedback table...\n');

    // Create table
    await sql`
      CREATE TABLE IF NOT EXISTS report_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        would_recommend BOOLEAN,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✓ Created report_feedback table');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_report_feedback_report_id ON report_feedback(report_id)`;
    console.log('✓ Created report_id index');

    await sql`CREATE INDEX IF NOT EXISTS idx_report_feedback_created_at ON report_feedback(created_at DESC)`;
    console.log('✓ Created created_at index');

    await sql`CREATE INDEX IF NOT EXISTS idx_report_feedback_rating ON report_feedback(rating)`;
    console.log('✓ Created rating index');

    await sql`COMMENT ON TABLE report_feedback IS 'User feedback for individual EV-Risk reports'`;
    console.log('✓ Added table comment');

    console.log('\n✅ Report feedback table created successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
