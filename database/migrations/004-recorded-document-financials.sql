BEGIN;
-- A file-management rental record does not extract/verify billable measurements.
-- The DTO area remains its separately identified commercial inventory reference.
ALTER TABLE leasing.lease_versions ALTER COLUMN chargeable_area_m2 DROP NOT NULL, ALTER COLUMN chargeable_area_basis DROP NOT NULL;
COMMIT;
