-- Allow a reviewed proposal to create one unlinked member and one relationship atomically.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.change_requests'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%relationship_create%'
  LOOP
    EXECUTE format('ALTER TABLE public.change_requests DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE change_requests
  ADD CONSTRAINT change_requests_type_allowed CHECK (
    type IN ('member_create', 'relationship_create', 'relationship_update', 'relationship_remove')
  ),
  ADD CONSTRAINT change_requests_payload_shape CHECK (
    (type IN ('member_create', 'relationship_create')
      AND target_id IS NULL
      AND base_version IS NULL
      AND proposed_payload IS NOT NULL)
    OR
    (type = 'relationship_update'
      AND target_id IS NOT NULL
      AND base_version IS NOT NULL
      AND proposed_payload IS NOT NULL)
    OR
    (type = 'relationship_remove'
      AND target_id IS NOT NULL
      AND base_version IS NOT NULL
      AND proposed_payload IS NULL)
  );
