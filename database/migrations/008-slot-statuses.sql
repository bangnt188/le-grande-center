BEGIN;
SELECT set_config('app.actor_id','system:slot-statuses',true);

ALTER TABLE leasing.slots DROP CONSTRAINT IF EXISTS slots_operational_status_check;

UPDATE leasing.slots SET operational_status = 'Còn trống' WHERE operational_status = 'Trống';
UPDATE leasing.slots SET operational_status = 'Đã thuê' WHERE operational_status = 'Đang thuê';

ALTER TABLE leasing.slots ADD CONSTRAINT slots_operational_status_check
  CHECK (operational_status IN ('Còn trống', 'Liên hệ', 'Đã thuê', 'Trống', 'Đang thuê'));

ALTER TABLE leasing.slots ALTER COLUMN operational_status SET DEFAULT 'Còn trống';
COMMIT;
