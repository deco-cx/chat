-- Drop entity_type and entity_id columns from deco_chat_access table
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deco_chat_access' 
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE deco_chat_access DROP COLUMN entity_type;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deco_chat_access' 
        AND column_name = 'entity_id'
    ) THEN
        ALTER TABLE deco_chat_access DROP COLUMN entity_id;
    END IF;
END $$;

-- Drop the deco_chat_entity_type enum type
DO $$ BEGIN
    DROP TYPE IF EXISTS deco_chat_entity_type;
END $$;

-- Enable Row Level Security for deco_chat_access table
ALTER TABLE deco_chat_access ENABLE ROW LEVEL SECURITY; 