BEGIN;
SELECT set_config('app.actor_id','system:shared-backend-crud',true);

-- The shared CRUD adapter uses one optimistic version per property-scoped company,
-- lead, and appointment. Existing appointment revisions start at one for the API.
ALTER TABLE leasing.property_customers
  ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1);
ALTER TABLE leasing.leads
  ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1);
UPDATE leasing.appointments SET revision = 1 WHERE revision = 0;
ALTER TABLE leasing.appointments ALTER COLUMN revision SET DEFAULT 1;
ALTER TABLE leasing.appointments ADD CONSTRAINT appointments_crud_revision_positive CHECK (revision >= 1);

-- No FK to properties/users: policy decisions must commit independently while a
-- business transaction may hold those rows. Store no request body or session data.
CREATE TABLE leasing.backend_access_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  actor_user_id uuid,
  policy_version text NOT NULL,
  permission text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  allowed boolean NOT NULL,
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL
);
ALTER TABLE leasing.backend_access_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY trusted_server_transaction ON leasing.backend_access_decisions TO leasing_runtime
  USING (coalesce(current_setting('app.actor_id',true),'')<>'')
  WITH CHECK (coalesce(current_setting('app.actor_id',true),'')<>'');
REVOKE ALL ON leasing.backend_access_decisions FROM PUBLIC;
GRANT INSERT ON leasing.backend_access_decisions TO leasing_runtime;
CREATE FUNCTION leasing.reject_backend_access_decision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Backend access decisions are append-only';
END;
$$;
CREATE TRIGGER immutable_backend_access_decision BEFORE UPDATE OR DELETE ON leasing.backend_access_decisions
  FOR EACH ROW EXECUTE FUNCTION leasing.reject_backend_access_decision_change();
COMMIT;
