ALTER TABLE deco_chat_triggers ADD COLUMN IF NOT EXISTS binding_id UUID REFERENCES deco_chat_integrations(id);
