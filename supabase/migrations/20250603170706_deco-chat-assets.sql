CREATE TABLE IF NOT EXISTS public.deco_chat_assets (
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    file_url TEXT NOT NULL,
    workspace TEXT NOT NULL,
    metadata JSONB NULL,
    CONSTRAINT deco_chat_assets_pkey PRIMARY KEY (file_url, workspace)
);

-- Enable Row Level Security
ALTER TABLE public.deco_chat_assets ENABLE ROW LEVEL SECURITY;
