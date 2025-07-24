-- Add version column with UUID default (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deco_chat_hosting_apps' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE deco_chat_hosting_apps 
    ADD COLUMN version uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Add production column as boolean with default false (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deco_chat_hosting_apps' 
    AND column_name = 'production'
  ) THEN
    ALTER TABLE deco_chat_hosting_apps 
    ADD COLUMN production boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Drop the existing unique constraint on slug only (idempotent)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'deco_chat_hosting_apps' 
    AND constraint_name = 'deco_chat_hosting_apps_slug_key'
  ) THEN
    ALTER TABLE deco_chat_hosting_apps 
    DROP CONSTRAINT deco_chat_hosting_apps_slug_key;
  END IF;
END $$;

-- Add new unique constraint on (slug, version) (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'deco_chat_hosting_apps' 
    AND constraint_name = 'deco_chat_hosting_apps_slug_version_key'
  ) THEN
    ALTER TABLE deco_chat_hosting_apps 
    ADD CONSTRAINT deco_chat_hosting_apps_slug_version_key UNIQUE (slug, version);
  END IF;
END $$;

-- Add index for fast lookup by slug and production status (already idempotent)
CREATE INDEX IF NOT EXISTS idx_hosting_apps_slug_production
  ON deco_chat_hosting_apps (slug, production);
