

-- Drop the specific trigger that's causing the issue
DROP TRIGGER IF EXISTS trg_validate_visibilities_entity_type ON deco_chat_access;

-- Drop the associated function
DROP FUNCTION IF EXISTS validate_visibilities_entity_type(); 