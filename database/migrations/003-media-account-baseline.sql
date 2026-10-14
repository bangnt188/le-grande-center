BEGIN;
-- Existing public mall-assets content remains externally managed but consumes the same account allowance.
-- NULL means no verified inventory yet: upload must fail closed until bootstrap/reconciliation supplies it.
ALTER TABLE leasing.media_storage ADD COLUMN external_bytes bigint CHECK(external_bytes>=0), ADD COLUMN external_reconciled_at timestamptz;
DO $$ DECLARE constraint_name text;BEGIN FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='leasing.media_storage'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%8500000000%' LOOP EXECUTE format('ALTER TABLE leasing.media_storage DROP CONSTRAINT %I',constraint_name);END LOOP;END $$;
ALTER TABLE leasing.media_storage ADD CONSTRAINT account_media_quota CHECK(used_bytes+reserved_bytes+coalesce(external_bytes,0)<=8500000000), ADD CONSTRAINT external_inventory_complete CHECK((external_bytes IS NULL)=(external_reconciled_at IS NULL));
COMMIT;
