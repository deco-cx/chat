-- Create apps registry tools table
CREATE TABLE IF NOT EXISTS public.deco_chat_apps_registry_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.deco_chat_apps_registry(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  input_schema jsonb,
  output_schema jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_registry_tool_app_name UNIQUE(app_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_registry_tools_app_id
  ON public.deco_chat_apps_registry_tools (app_id);

CREATE INDEX IF NOT EXISTS idx_registry_tools_name
  ON public.deco_chat_apps_registry_tools (name);

-- Enable Row Level Security
ALTER TABLE public.deco_chat_apps_registry_tools ENABLE ROW LEVEL SECURITY;
