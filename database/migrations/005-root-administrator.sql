BEGIN;
SELECT set_config('app.actor_id','system:root-administrator-migration',true);

CREATE TABLE leasing.root_allowlist (
  property_id uuid NOT NULL REFERENCES leasing.properties,
  email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  user_id uuid UNIQUE REFERENCES leasing.users,
  revoked_at timestamptz,
  PRIMARY KEY (property_id,email)
);
CALL row_audit.apply('leasing',ARRAY['root_allowlist'],'system:root-administrator-migration');

-- Promote only the configured owner entry. Preserve a previously linked Auth subject,
-- then soft-delete it from the ordinary administrator allowlist in this same transaction.
INSERT INTO leasing.root_allowlist(property_id,email,user_id,revoked_at)
SELECT property_id,lower(email),user_id,revoked_at
FROM leasing.admin_allowlist
WHERE lower(email)='nguyenbang.skyone@gmail.com'
ON CONFLICT(property_id,email) DO NOTHING;
UPDATE leasing.admin_allowlist SET user_id=NULL,deleted_at=now()
WHERE lower(email)='nguyenbang.skyone@gmail.com' AND deleted_at IS NULL;

ALTER TABLE leasing.root_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_server_transaction ON leasing.root_allowlist TO leasing_runtime
  USING (coalesce(current_setting('app.actor_id',true),'')<>'')
  WITH CHECK (coalesce(current_setting('app.actor_id',true),'')<>'');
REVOKE ALL ON leasing.root_allowlist FROM PUBLIC;
GRANT SELECT,UPDATE ON leasing.root_allowlist TO leasing_runtime;
COMMIT;
