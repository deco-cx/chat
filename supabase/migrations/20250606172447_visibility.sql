-- Create enum type for visibility (idempotent)
DO $$ BEGIN
    CREATE TYPE deco_chat_visibility_type AS ENUM ('public', 'private', 'role_based');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new enum values if they don't exist (idempotent)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'private' AND enumtypid = 'deco_chat_visibility_type'::regtype) THEN
        ALTER TYPE deco_chat_visibility_type ADD VALUE 'private';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'role_based' AND enumtypid = 'deco_chat_visibility_type'::regtype) THEN
        ALTER TYPE deco_chat_visibility_type ADD VALUE 'role_based';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the access table (idempotent)
CREATE TABLE IF NOT EXISTS deco_chat_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visibility deco_chat_visibility_type NOT NULL DEFAULT 'private',
    owner_id UUID NOT NULL,
    allowed_roles TEXT[] DEFAULT '{}'
);

-- Set the default value to 'private' after the enum values are committed
DO $$ BEGIN
    ALTER TABLE deco_chat_access ALTER COLUMN visibility SET DEFAULT 'private';
EXCEPTION
    WHEN others THEN null;
END $$;

-- Add access_id column to agents table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deco_chat_agents' 
        AND column_name = 'access_id'
    ) THEN
        ALTER TABLE deco_chat_agents 
        ADD COLUMN access_id UUID REFERENCES deco_chat_access(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add access_id column to integrations table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deco_chat_integrations' 
        AND column_name = 'access_id'
    ) THEN
        ALTER TABLE deco_chat_integrations 
        ADD COLUMN access_id UUID REFERENCES deco_chat_access(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add access_id column to triggers table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deco_chat_triggers' 
        AND column_name = 'access_id'
    ) THEN
        ALTER TABLE deco_chat_triggers 
        ADD COLUMN access_id UUID REFERENCES deco_chat_access(id) ON DELETE CASCADE;
    END IF;
END $$;
