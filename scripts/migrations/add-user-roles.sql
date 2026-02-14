CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'free'
    CHECK (role IN ('free', 'pro', 'admin')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL,
  granted_by TEXT NULL,
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
