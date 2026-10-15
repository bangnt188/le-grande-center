BEGIN;
SELECT set_config('app.actor_id','system:password-root-account',true);

INSERT INTO leasing.root_allowlist (property_id,email)
SELECT id,'root@legrandecentre.vn' FROM leasing.properties WHERE code='le-grande-centre'
ON CONFLICT (property_id,email) DO NOTHING;

-- Preserve the historical binding, but stop granting root through the old Google account.
UPDATE leasing.root_allowlist SET revoked_at=now()
WHERE email='nguyenbang.skyone@gmail.com' AND revoked_at IS NULL AND deleted_at IS NULL;

COMMIT;
