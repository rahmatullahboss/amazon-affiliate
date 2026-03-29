ALTER TABLE users ADD COLUMN google_sub TEXT;

CREATE INDEX IF NOT EXISTS idx_users_google_sub
ON users(google_sub);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub_unique
ON users(google_sub)
WHERE google_sub IS NOT NULL;
