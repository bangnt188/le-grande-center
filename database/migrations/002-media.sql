BEGIN;
ALTER TABLE leasing.documents ADD COLUMN media_scope text NOT NULL DEFAULT 'Toàn dự án';
ALTER TABLE leasing.document_versions ADD COLUMN public_url text, ADD COLUMN manual_reviewed_by uuid REFERENCES leasing.users, ADD COLUMN manual_reviewed_at timestamptz, ADD COLUMN manual_review_note text;
DO $$ DECLARE constraint_name text;BEGIN FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='leasing.document_versions'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%sealed_at%' AND pg_get_constraintdef(oid) LIKE '%scan_state%' LOOP EXECUTE format('ALTER TABLE leasing.document_versions DROP CONSTRAINT %I',constraint_name);END LOOP;END $$;
ALTER TABLE leasing.document_versions ADD CONSTRAINT document_manual_review_complete CHECK ((manual_reviewed_by IS NULL AND manual_reviewed_at IS NULL AND manual_review_note IS NULL) OR (manual_reviewed_by IS NOT NULL AND manual_reviewed_at IS NOT NULL AND length(manual_review_note) BETWEEN 10 AND 2000)), ADD CONSTRAINT document_sealed_release CHECK (sealed_at IS NULL OR scan_state='clean' OR manual_reviewed_by IS NOT NULL);
CREATE TABLE leasing.media_storage (
 property_id uuid PRIMARY KEY REFERENCES leasing.properties,
 used_bytes bigint NOT NULL DEFAULT 0 CHECK(used_bytes>=0), reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
 CHECK(used_bytes+reserved_bytes<=8500000000)
);
CREATE TABLE leasing.media_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES leasing.properties,actor_user_id uuid NOT NULL REFERENCES leasing.users,
 request_key text NOT NULL,request_sha256 char(64) NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),expected_revision bigint NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','finalized','failed')),result_revision bigint,
 UNIQUE(property_id,actor_user_id,request_key),UNIQUE(id,property_id)
);
-- Mutable storage lifecycle is separate from immutable sealed document bytes and retained contract links.
CREATE TABLE leasing.media_object_state (
 document_version_id uuid PRIMARY KEY,property_id uuid NOT NULL,batch_id uuid,
 state text NOT NULL CHECK(state IN ('reserved','quarantine','ready','deleting','deleted')),
 FOREIGN KEY(document_version_id,property_id) REFERENCES leasing.document_versions(id,property_id),
 FOREIGN KEY(batch_id,property_id) REFERENCES leasing.media_batches(id,property_id)
);
CALL row_audit.apply('leasing',ARRAY['media_storage','media_batches','media_object_state'],'system:media-migration');
CREATE INDEX media_cleanup_pending ON leasing.media_batches(created_at) WHERE state='reserved';
GRANT SELECT,INSERT,UPDATE,DELETE ON leasing.media_storage,leasing.media_batches,leasing.media_object_state TO leasing_runtime;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['media_storage','media_batches','media_object_state'] LOOP
 EXECUTE format('ALTER TABLE leasing.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY trusted_server_transaction ON leasing.%I TO leasing_runtime USING (coalesce(current_setting(''app.actor_id'',true),'''')<>'''') WITH CHECK (coalesce(current_setting(''app.actor_id'',true),'''')<>'''')',t);
END LOOP;END $$;
COMMIT;
