-- Private, family-scoped media, Moments, and Memories.

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  owner_membership_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('moment_image', 'memory_image', 'memory_audio')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'rejected', 'deleted')),
  object_key varchar(500) NOT NULL CHECK (length(trim(object_key)) > 0),
  processed_object_key varchar(500),
  mime_type varchar(120) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 25000000),
  sha256 char(64) CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  duration_ms integer CHECK (duration_ms BETWEEN 1 AND 600000),
  rejection_code varchar(120),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(family_id, id),
  UNIQUE(object_key),
  UNIQUE(processed_object_key),
  FOREIGN KEY(family_id, owner_membership_id)
    REFERENCES family_memberships(family_id, id),
  CHECK (
    (purpose IN ('moment_image', 'memory_image')
      AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')
      AND byte_size <= 10000000
      AND duration_ms IS NULL)
    OR
    (purpose = 'memory_audio'
      AND mime_type IN ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg')
      AND width IS NULL AND height IS NULL)
  ),
  CHECK (processed_object_key IS NULL OR length(trim(processed_object_key)) > 0),
  CHECK (rejection_code IS NULL OR length(trim(rejection_code)) > 0),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CHECK (status <> 'rejected' OR rejection_code IS NOT NULL)
);

CREATE INDEX media_assets_family_owner_created
  ON media_assets(family_id, owner_membership_id, created_at DESC, id DESC);
CREATE INDEX media_assets_pending_processing
  ON media_assets(status, updated_at, id) WHERE status IN ('pending', 'processing');

CREATE TABLE moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  author_membership_id uuid NOT NULL,
  media_id uuid NOT NULL,
  caption varchar(500),
  audience text NOT NULL CHECK (audience = 'family'),
  client_request_id varchar(128) NOT NULL CHECK (
    length(client_request_id) BETWEEN 8 AND 128
    AND client_request_id ~ '^[A-Za-z0-9._:-]+$'
  ),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(family_id, id),
  UNIQUE(family_id, author_membership_id, client_request_id),
  FOREIGN KEY(family_id, author_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, media_id) REFERENCES media_assets(family_id, id),
  CHECK (caption IS NULL OR length(trim(caption)) > 0)
);

CREATE INDEX moments_family_feed
  ON moments(family_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE moment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  moment_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  reaction text NOT NULL CHECK (reaction = 'thuong'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  UNIQUE(family_id, moment_id, membership_id),
  FOREIGN KEY(family_id, moment_id) REFERENCES moments(family_id, id),
  FOREIGN KEY(family_id, membership_id)
    REFERENCES family_memberships(family_id, id)
);

CREATE INDEX moment_reactions_moment
  ON moment_reactions(family_id, moment_id, created_at, id);

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  created_by_membership_id uuid NOT NULL,
  source_moment_id uuid,
  title varchar(160) NOT NULL CHECK (length(trim(title)) > 0),
  occurred_on date NOT NULL,
  audience text NOT NULL CHECK (audience = 'family'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(family_id, id),
  UNIQUE(family_id, source_moment_id),
  FOREIGN KEY(family_id, created_by_membership_id)
    REFERENCES family_memberships(family_id, id),
  FOREIGN KEY(family_id, source_moment_id) REFERENCES moments(family_id, id)
);

CREATE INDEX memories_family_timeline
  ON memories(family_id, occurred_on DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  memory_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 49),
  kind text NOT NULL CHECK (kind IN ('image', 'text', 'audio')),
  media_id uuid,
  body varchar(4000),
  contributed_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(family_id, id),
  UNIQUE(family_id, memory_id, position),
  FOREIGN KEY(family_id, memory_id) REFERENCES memories(family_id, id),
  FOREIGN KEY(family_id, media_id) REFERENCES media_assets(family_id, id),
  FOREIGN KEY(family_id, contributed_by_membership_id)
    REFERENCES family_memberships(family_id, id),
  CHECK (
    (kind = 'text' AND media_id IS NULL AND body IS NOT NULL AND length(trim(body)) > 0)
    OR
    (kind IN ('image', 'audio') AND media_id IS NOT NULL AND body IS NULL)
  )
);

CREATE INDEX memory_items_memory_order
  ON memory_items(family_id, memory_id, position, id) WHERE deleted_at IS NULL;

CREATE TABLE media_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family_spaces(id),
  media_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('process', 'delete')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'completed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner varchar(120),
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_error_code varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, id),
  UNIQUE(family_id, media_id, kind),
  FOREIGN KEY(family_id, media_id) REFERENCES media_assets(family_id, id),
  CHECK (
    (status = 'leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX media_processing_jobs_claim
  ON media_processing_jobs(kind, status, available_at, id)
  WHERE status IN ('pending', 'leased');

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments FORCE ROW LEVEL SECURITY;
ALTER TABLE moment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moment_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories FORCE ROW LEVEL SECURITY;
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_items FORCE ROW LEVEL SECURITY;
ALTER TABLE media_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_processing_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_runtime_media_select ON media_assets FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_media_insert ON media_assets FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'media_write'
    AND public.actor_active_membership(family_id, owner_membership_id)
  );
CREATE POLICY tenant_runtime_media_update ON media_assets FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'media_write'
    AND (public.actor_active_membership(family_id, owner_membership_id)
      OR public.actor_active_admin(family_id))
  )
  WITH CHECK (public.actor_active_member(family_id));

CREATE POLICY tenant_runtime_moments_select ON moments FOR SELECT TO family_runtime
  USING (deleted_at IS NULL AND public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_moments_insert ON moments FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'moments_write'
    AND public.actor_active_membership(family_id, author_membership_id)
  );
CREATE POLICY tenant_runtime_moments_update ON moments FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'moments_write'
    AND (public.actor_active_membership(family_id, author_membership_id)
      OR public.actor_active_admin(family_id))
  )
  WITH CHECK (public.actor_active_member(family_id));

CREATE POLICY tenant_runtime_reactions_select ON moment_reactions FOR SELECT TO family_runtime
  USING (public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_reactions_insert ON moment_reactions FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'moments_write'
    AND public.actor_active_membership(family_id, membership_id)
  );
CREATE POLICY tenant_runtime_reactions_update ON moment_reactions FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'moments_write'
    AND public.actor_active_membership(family_id, membership_id)
  )
  WITH CHECK (public.actor_active_membership(family_id, membership_id));
CREATE POLICY tenant_runtime_reactions_delete ON moment_reactions FOR DELETE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'moments_write'
    AND public.actor_active_membership(family_id, membership_id)
  );

CREATE POLICY tenant_runtime_memories_select ON memories FOR SELECT TO family_runtime
  USING (deleted_at IS NULL AND public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_memories_insert ON memories FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'memories_write'
    AND public.actor_active_membership(family_id, created_by_membership_id)
  );
CREATE POLICY tenant_runtime_memories_update ON memories FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'memories_write'
    AND (public.actor_active_membership(family_id, created_by_membership_id)
      OR public.actor_active_admin(family_id))
  )
  WITH CHECK (public.actor_active_member(family_id));

CREATE POLICY tenant_runtime_memory_items_select ON memory_items FOR SELECT TO family_runtime
  USING (deleted_at IS NULL AND public.actor_active_member(family_id));
CREATE POLICY tenant_runtime_memory_items_insert ON memory_items FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'memories_write'
    AND public.actor_active_membership(family_id, contributed_by_membership_id)
  );
CREATE POLICY tenant_runtime_memory_items_update ON memory_items FOR UPDATE TO family_runtime
  USING (
    current_setting('app.purpose', true) = 'memories_write'
    AND (public.actor_active_membership(family_id, contributed_by_membership_id)
      OR public.actor_active_admin(family_id))
  )
  WITH CHECK (public.actor_active_member(family_id));

CREATE POLICY tenant_runtime_media_jobs_insert ON media_processing_jobs FOR INSERT TO family_runtime
  WITH CHECK (
    current_setting('app.purpose', true) = 'media_write'
    AND EXISTS (
      SELECT 1 FROM media_assets asset
       WHERE asset.family_id = media_processing_jobs.family_id
         AND asset.id = media_processing_jobs.media_id
         AND public.actor_active_membership(asset.family_id, asset.owner_membership_id)
    )
  );

REVOKE ALL ON media_assets, moments, moment_reactions, memories, memory_items,
  media_processing_jobs FROM PUBLIC, family_auth, family_worker;

GRANT SELECT ON media_assets, moments, moment_reactions, memories, memory_items TO family_runtime;
GRANT INSERT (
  family_id, owner_membership_id, purpose, status, object_key, mime_type, byte_size
) ON media_assets TO family_runtime;
GRANT UPDATE (status, version, updated_at) ON media_assets TO family_runtime;
GRANT INSERT (
  family_id, author_membership_id, media_id, caption, audience, client_request_id
) ON moments TO family_runtime;
GRANT UPDATE (version, deleted_at) ON moments TO family_runtime;
GRANT INSERT (family_id, moment_id, membership_id, reaction)
  ON moment_reactions TO family_runtime;
GRANT UPDATE (reaction, updated_at) ON moment_reactions TO family_runtime;
GRANT DELETE ON moment_reactions TO family_runtime;
GRANT INSERT (
  family_id, created_by_membership_id, source_moment_id, title, occurred_on, audience
) ON memories TO family_runtime;
GRANT UPDATE (version, updated_at, deleted_at) ON memories TO family_runtime;
GRANT INSERT (
  family_id, memory_id, position, kind, media_id, body, contributed_by_membership_id
) ON memory_items TO family_runtime;
GRANT UPDATE (deleted_at) ON memory_items TO family_runtime;
GRANT INSERT (family_id, media_id, kind) ON media_processing_jobs TO family_runtime;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'family_media_worker') THEN
    CREATE ROLE family_media_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  ELSE
    ALTER ROLE family_media_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO family_media_worker;
GRANT SELECT ON media_assets, media_processing_jobs TO family_media_worker;
GRANT UPDATE (
  status, attempts, available_at, lease_owner, lease_expires_at, completed_at,
  last_error_code, updated_at
) ON media_processing_jobs TO family_media_worker;
GRANT UPDATE (
  status, processed_object_key, mime_type, byte_size, sha256, width, height,
  duration_ms, rejection_code, version, updated_at, deleted_at
) ON media_assets TO family_media_worker;

CREATE FUNCTION public.worker_claim_media_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_now timestamptz
)
RETURNS TABLE(
  job_id uuid, family_id uuid, media_id uuid, kind text, object_key text,
  processed_object_key text, purpose text, mime_type text, byte_size bigint
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF length(trim(p_worker_id)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid worker id';
  END IF;
  IF p_batch_size NOT BETWEEN 1 AND 25 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media worker batch size';
  END IF;
  IF p_lease_seconds NOT BETWEEN 10 AND 300 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media worker lease';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
      FROM public.media_processing_jobs job
     WHERE job.kind = 'process' AND job.attempts < 5 AND job.available_at <= p_now
       AND (job.status = 'pending'
         OR (job.status = 'leased' AND job.lease_expires_at <= p_now))
     ORDER BY job.available_at, job.id
     FOR UPDATE SKIP LOCKED LIMIT p_batch_size
  ), leased AS (
    UPDATE public.media_processing_jobs job
       SET status = 'leased', lease_owner = p_worker_id,
           lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
           updated_at = p_now
      FROM candidates WHERE job.id = candidates.id
    RETURNING job.id, job.family_id, job.media_id, job.kind
  )
  SELECT leased.id, leased.family_id, leased.media_id, leased.kind,
         asset.object_key::text, asset.processed_object_key::text,
         asset.purpose, asset.mime_type, asset.byte_size
    FROM leased
    JOIN public.media_assets asset
      ON asset.family_id = leased.family_id AND asset.id = leased.media_id;
END
$$;

CREATE FUNCTION public.worker_complete_media_job(
  p_job_id uuid, p_worker_id text, p_processed_object_key text,
  p_mime_type text, p_byte_size bigint, p_sha256 text,
  p_width integer, p_height integer, p_duration_ms integer, p_now timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed public.media_processing_jobs%ROWTYPE;
BEGIN
  SELECT * INTO claimed FROM public.media_processing_jobs job
   WHERE job.id = p_job_id AND job.kind = 'process' AND job.status = 'leased'
     AND job.lease_owner = p_worker_id AND job.lease_expires_at > p_now
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_assets asset
     SET status = 'ready', processed_object_key = p_processed_object_key,
         mime_type = p_mime_type, byte_size = p_byte_size, sha256 = p_sha256,
         width = p_width, height = p_height, duration_ms = p_duration_ms,
         rejection_code = NULL, version = version + 1, updated_at = p_now
   WHERE asset.family_id = claimed.family_id AND asset.id = claimed.media_id
     AND asset.status = 'processing';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_processing_jobs SET status = 'completed', completed_at = p_now,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = p_now
   WHERE id = p_job_id;
  RETURN true;
END
$$;

CREATE FUNCTION public.worker_reject_media_job(
  p_job_id uuid, p_worker_id text, p_rejection_code text, p_now timestamptz
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE claimed public.media_processing_jobs%ROWTYPE;
BEGIN
  IF length(trim(p_rejection_code)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media rejection code';
  END IF;
  SELECT * INTO claimed FROM public.media_processing_jobs job
   WHERE job.id = p_job_id AND job.kind = 'process' AND job.status = 'leased'
     AND job.lease_owner = p_worker_id AND job.lease_expires_at > p_now
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.media_assets SET status = 'rejected', rejection_code = p_rejection_code,
         version = version + 1, updated_at = p_now
   WHERE family_id = claimed.family_id AND id = claimed.media_id AND status = 'processing';
  UPDATE public.media_processing_jobs SET status = 'completed', completed_at = p_now,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = p_now
   WHERE id = p_job_id;
  RETURN true;
END
$$;

CREATE FUNCTION public.worker_fail_media_job(
  p_job_id uuid, p_worker_id text, p_error_code text, p_now timestamptz
)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE next_status text;
BEGIN
  IF length(trim(p_error_code)) NOT BETWEEN 1 AND 120 THEN
    RAISE invalid_parameter_value USING MESSAGE = 'invalid media failure code';
  END IF;
  UPDATE public.media_processing_jobs job
     SET attempts = attempts + 1,
         status = CASE WHEN attempts + 1 >= 5 THEN 'dead_letter' ELSE 'pending' END,
         available_at = p_now + make_interval(secs => LEAST(300, 5 * (2 ^ attempts)::integer)),
         lease_owner = NULL, lease_expires_at = NULL, last_error_code = p_error_code,
         updated_at = p_now
   WHERE job.id = p_job_id AND job.status = 'leased' AND job.lease_owner = p_worker_id
     AND job.lease_expires_at > p_now
  RETURNING status INTO next_status;
  IF next_status IS NULL THEN RETURN 'lost'; END IF;
  RETURN next_status;
END
$$;

ALTER FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_complete_media_job(
  uuid, text, text, text, bigint, text, integer, integer, integer, timestamptz
) OWNER TO family_media_worker;
ALTER FUNCTION public.worker_reject_media_job(uuid, text, text, timestamptz)
  OWNER TO family_media_worker;
ALTER FUNCTION public.worker_fail_media_job(uuid, text, text, timestamptz)
  OWNER TO family_media_worker;

REVOKE ALL ON FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_job(uuid, text, text, text, bigint, text, integer, integer, integer, timestamptz),
  public.worker_reject_media_job(uuid, text, text, timestamptz),
  public.worker_fail_media_job(uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_claim_media_jobs(text, integer, integer, timestamptz),
  public.worker_complete_media_job(uuid, text, text, text, bigint, text, integer, integer, integer, timestamptz),
  public.worker_reject_media_job(uuid, text, text, timestamptz),
  public.worker_fail_media_job(uuid, text, text, timestamptz) TO family_worker;
