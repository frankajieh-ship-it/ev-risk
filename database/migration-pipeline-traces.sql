-- Pipeline trace table for debug/content instrumentation
CREATE TABLE IF NOT EXISTS pipeline_traces (
  id TEXT PRIMARY KEY,
  pipeline TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  timings JSONB NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}',
  total_latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pipeline_traces_pipeline_created_at ON pipeline_traces (pipeline, created_at DESC);
