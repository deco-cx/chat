-- Add spaces column to deco_chat_agents table
ALTER TABLE deco_chat_agents ADD COLUMN spaces jsonb DEFAULT '{}';

-- Add a comment to document the column
COMMENT ON COLUMN deco_chat_agents.spaces IS 'Saved space configurations for different editing layouts';