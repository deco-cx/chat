-- Update foreign key constraint on deco_chat_wpp_invites.trigger_id to SET NULL on delete (idempotent)

-- Drop existing foreign key constraint for invites trigger_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_trigger_id_fkey'
    AND table_name = 'deco_chat_wpp_invites'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites DROP CONSTRAINT deco_chat_wpp_invites_trigger_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint with ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deco_chat_wpp_invites_trigger_id_fkey'
    AND table_name = 'deco_chat_wpp_invites'
  ) THEN
    ALTER TABLE deco_chat_wpp_invites
    ADD CONSTRAINT deco_chat_wpp_invites_trigger_id_fkey
    FOREIGN KEY (trigger_id) REFERENCES deco_chat_triggers(id) ON DELETE SET NULL;
  END IF;
END $$; 