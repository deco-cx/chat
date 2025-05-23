CREATE TABLE IF NOT EXISTS deco_chat_customer (
  customer_id TEXT NOT NULL,
  workspace TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT deco_chat_customer_pkey PRIMARY KEY (customer_id),
  CONSTRAINT deco_chat_customer_workspace_key UNIQUE (workspace)
);

CREATE INDEX IF NOT EXISTS idx_deco_chat_customer_workspace
  ON deco_chat_customer (workspace);

CREATE INDEX IF NOT EXISTS idx_deco_chat_customer_customer_id
  ON deco_chat_customer (customer_id);

ALTER TABLE deco_chat_customer ENABLE ROW LEVEL SECURITY;
