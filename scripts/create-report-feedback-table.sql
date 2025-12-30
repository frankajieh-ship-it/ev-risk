-- Create report_feedback table for report-specific feedback
CREATE TABLE IF NOT EXISTS report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  would_recommend BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_report_feedback_report_id ON report_feedback(report_id);
CREATE INDEX IF NOT EXISTS idx_report_feedback_created_at ON report_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_feedback_rating ON report_feedback(rating);

-- Add comment to table
COMMENT ON TABLE report_feedback IS 'User feedback for individual EV-Risk reports';
