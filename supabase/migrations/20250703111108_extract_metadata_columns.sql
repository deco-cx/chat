-- Add new columns to deco_chat_assets table
ALTER TABLE public.deco_chat_assets 
ADD COLUMN index_name TEXT,
ADD COLUMN path TEXT,
ADD COLUMN doc_ids TEXT[],
ADD COLUMN filename TEXT;

-- Create index on index_name for better query performance
CREATE INDEX idx_deco_chat_assets_index_name ON public.deco_chat_assets(index_name);
CREATE INDEX idx_deco_chat_assets_workspace_index_name ON public.deco_chat_assets(workspace, index_name);
