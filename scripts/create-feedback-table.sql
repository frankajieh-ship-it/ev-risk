-- Create feedback table for storing user feedback
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
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(feedback_type);

-- Add comment to table
COMMENT ON TABLE feedback IS 'User feedback submissions for EV-Risk application improvements';
