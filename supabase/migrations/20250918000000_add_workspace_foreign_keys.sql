-- Migration: Add foreign key columns to workspace tables
-- This migration adds project_id and org_id columns to all tables that currently use workspace strings
-- while maintaining backward compatibility during the transition period

-- Add foreign key columns to deco_chat_channels
ALTER TABLE public.deco_chat_channels
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_channels
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_channels_project_id_fkey'
        AND table_name = 'deco_chat_channels'
    ) THEN
        ALTER TABLE public.deco_chat_channels
        ADD CONSTRAINT deco_chat_channels_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_channels_org_id_fkey'
        AND table_name = 'deco_chat_channels'
    ) THEN
        ALTER TABLE public.deco_chat_channels
        ADD CONSTRAINT deco_chat_channels_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_channels
CREATE INDEX IF NOT EXISTS idx_channels_project_id ON public.deco_chat_channels (project_id);
CREATE INDEX IF NOT EXISTS idx_channels_org_id ON public.deco_chat_channels (org_id);

-- Add foreign key columns to deco_chat_assets
ALTER TABLE public.deco_chat_assets
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_assets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_assets_project_id_fkey'
        AND table_name = 'deco_chat_assets'
    ) THEN
        ALTER TABLE public.deco_chat_assets
        ADD CONSTRAINT deco_chat_assets_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_assets_org_id_fkey'
        AND table_name = 'deco_chat_assets'
    ) THEN
        ALTER TABLE public.deco_chat_assets
        ADD CONSTRAINT deco_chat_assets_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_assets
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.deco_chat_assets (project_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON public.deco_chat_assets (org_id);

-- Add foreign key columns to deco_chat_customer
ALTER TABLE public.deco_chat_customer
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_customer
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_customer_project_id_fkey'
        AND table_name = 'deco_chat_customer'
    ) THEN
        ALTER TABLE public.deco_chat_customer
        ADD CONSTRAINT deco_chat_customer_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_customer_org_id_fkey'
        AND table_name = 'deco_chat_customer'
    ) THEN
        ALTER TABLE public.deco_chat_customer
        ADD CONSTRAINT deco_chat_customer_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_customer
CREATE INDEX IF NOT EXISTS idx_customer_project_id ON public.deco_chat_customer (project_id);
CREATE INDEX IF NOT EXISTS idx_customer_org_id ON public.deco_chat_customer (org_id);

-- Add foreign key columns to deco_chat_api_keys
ALTER TABLE public.deco_chat_api_keys
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_api_keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_api_keys_project_id_fkey'
        AND table_name = 'deco_chat_api_keys'
    ) THEN
        ALTER TABLE public.deco_chat_api_keys
        ADD CONSTRAINT deco_chat_api_keys_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_api_keys_org_id_fkey'
        AND table_name = 'deco_chat_api_keys'
    ) THEN
        ALTER TABLE public.deco_chat_api_keys
        ADD CONSTRAINT deco_chat_api_keys_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON public.deco_chat_api_keys (project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON public.deco_chat_api_keys (org_id);

-- Add foreign key columns to deco_chat_hosting_apps
ALTER TABLE public.deco_chat_hosting_apps
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_hosting_apps
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_hosting_apps_project_id_fkey'
        AND table_name = 'deco_chat_hosting_apps'
    ) THEN
        ALTER TABLE public.deco_chat_hosting_apps
        ADD CONSTRAINT deco_chat_hosting_apps_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_hosting_apps_org_id_fkey'
        AND table_name = 'deco_chat_hosting_apps'
    ) THEN
        ALTER TABLE public.deco_chat_hosting_apps
        ADD CONSTRAINT deco_chat_hosting_apps_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_hosting_apps
CREATE INDEX IF NOT EXISTS idx_hosting_apps_project_id ON public.deco_chat_hosting_apps (project_id);
CREATE INDEX IF NOT EXISTS idx_hosting_apps_org_id ON public.deco_chat_hosting_apps (org_id);

-- Add foreign key columns to deco_chat_apps_registry
ALTER TABLE public.deco_chat_apps_registry
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_apps_registry
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_apps_registry_project_id_fkey'
        AND table_name = 'deco_chat_apps_registry'
    ) THEN
        ALTER TABLE public.deco_chat_apps_registry
        ADD CONSTRAINT deco_chat_apps_registry_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_apps_registry_org_id_fkey'
        AND table_name = 'deco_chat_apps_registry'
    ) THEN
        ALTER TABLE public.deco_chat_apps_registry
        ADD CONSTRAINT deco_chat_apps_registry_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_apps_registry
CREATE INDEX IF NOT EXISTS idx_apps_registry_project_id ON public.deco_chat_apps_registry (project_id);
CREATE INDEX IF NOT EXISTS idx_apps_registry_org_id ON public.deco_chat_apps_registry (org_id);

-- Add foreign key columns to deco_chat_oauth_codes
ALTER TABLE public.deco_chat_oauth_codes
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_oauth_codes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_oauth_codes_project_id_fkey'
        AND table_name = 'deco_chat_oauth_codes'
    ) THEN
        ALTER TABLE public.deco_chat_oauth_codes
        ADD CONSTRAINT deco_chat_oauth_codes_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_oauth_codes_org_id_fkey'
        AND table_name = 'deco_chat_oauth_codes'
    ) THEN
        ALTER TABLE public.deco_chat_oauth_codes
        ADD CONSTRAINT deco_chat_oauth_codes_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_oauth_codes
CREATE INDEX IF NOT EXISTS idx_oauth_codes_project_id ON public.deco_chat_oauth_codes (project_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_org_id ON public.deco_chat_oauth_codes (org_id);

-- Add foreign key columns to deco_chat_registry_scopes
ALTER TABLE public.deco_chat_registry_scopes
ADD COLUMN IF NOT EXISTS project_id uuid,
ADD COLUMN IF NOT EXISTS org_id int8;

-- Add foreign key constraints for deco_chat_registry_scopes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_registry_scopes_project_id_fkey'
        AND table_name = 'deco_chat_registry_scopes'
    ) THEN
        ALTER TABLE public.deco_chat_registry_scopes
        ADD CONSTRAINT deco_chat_registry_scopes_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.deco_chat_projects(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'deco_chat_registry_scopes_org_id_fkey'
        AND table_name = 'deco_chat_registry_scopes'
    ) THEN
        ALTER TABLE public.deco_chat_registry_scopes
        ADD CONSTRAINT deco_chat_registry_scopes_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.teams(id);
    END IF;
END $$;

-- Add indexes for deco_chat_registry_scopes
CREATE INDEX IF NOT EXISTS idx_registry_scopes_project_id ON public.deco_chat_registry_scopes (project_id);
CREATE INDEX IF NOT EXISTS idx_registry_scopes_org_id ON public.deco_chat_registry_scopes (org_id);
