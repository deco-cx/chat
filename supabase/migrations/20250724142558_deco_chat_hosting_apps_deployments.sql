-- Create new deployments table
CREATE TABLE IF NOT EXISTS deco_chat_hosting_apps_deployments (
  id text PRIMARY KEY,
  hosting_app_id uuid NOT NULL,
  cloudflare_deployment_id text, -- the Cloudflare worker/deployment identifier
  files jsonb, -- the files that make up the deployment
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz, -- for soft deletes
  CONSTRAINT fk_hosting_app_deployment FOREIGN KEY (hosting_app_id) REFERENCES deco_chat_hosting_apps (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hosting_apps_deployments_hosting_app_id
  ON deco_chat_hosting_apps_deployments (hosting_app_id);

CREATE INDEX IF NOT EXISTS idx_hosting_apps_deployments_created_at
  ON deco_chat_hosting_apps_deployments (created_at);

-- Enable Row Level Security
ALTER TABLE deco_chat_hosting_apps_deployments ENABLE ROW LEVEL SECURITY;
