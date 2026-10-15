BEGIN;
SELECT set_config('app.actor_id','system:staff-accounts',true);

ALTER TABLE leasing.staff_assignments
  DROP CONSTRAINT staff_assignments_role_code_check,
  ADD CONSTRAINT staff_assignments_role_code_check
    CHECK (role_code IN ('leasing','legal','finance','operations','administrator','editor'));
ALTER TABLE leasing.admin_allowlist
  ADD COLUMN role_code text NOT NULL DEFAULT 'administrator'
    CHECK (role_code IN ('administrator','editor')),
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

COMMIT;
