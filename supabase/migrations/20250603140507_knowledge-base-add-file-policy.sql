WITH current AS (
  SELECT id, statements
  FROM public.policies
  WHERE id = 43
),
to_add AS (
  SELECT unnest(ARRAY[
    '{"effect":"allow","resource":"KNOWLEDGE_BASE_ADD_FILE"}'::jsonb
  ]) AS new_statement
),
missing AS (
  SELECT current.id, current.statements, array_agg(to_add.new_statement) AS new_statements
  FROM current
  JOIN to_add
    ON NOT EXISTS (
      SELECT 1
      FROM unnest(current.statements) AS stmt
      WHERE stmt = to_add.new_statement
    )
  GROUP BY current.id, current.statements
)
UPDATE public.policies
SET statements = array_cat(missing.statements, missing.new_statements)
FROM missing
WHERE public.policies.id = missing.id;

