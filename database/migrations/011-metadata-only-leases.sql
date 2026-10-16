BEGIN;
SELECT set_config('app.actor_id','system:migration',true);
-- Only new records get the external-original wording; frozen historical terms are unchanged.
ALTER TABLE leasing.lease_versions ALTER COLUMN rent_note SET DEFAULT 'Hợp đồng gốc được lưu ngoài hệ thống';
CREATE OR REPLACE FUNCTION leasing.assert_commitment_allocation(kind text,commitment_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE blocks_inventory boolean;version_id uuid;expected_period daterange;expected_slots uuid[];actual_slots uuid[];
BEGIN
 IF commitment_id IS NULL THEN RETURN; END IF;
 IF kind='reservation' THEN
  SELECT r.status='active',rs.space_version_id,r.occupancy_period INTO blocks_inventory,version_id,expected_period FROM leasing.reservations r JOIN leasing.request_spaces rs ON rs.id=r.request_space_id WHERE r.id=commitment_id FOR SHARE OF r,rs;
  IF NOT FOUND THEN RETURN; END IF;
  IF blocks_inventory AND NOT EXISTS(SELECT 1 FROM leasing.reservations r JOIN leasing.leasing_requests q ON q.id=r.request_id JOIN leasing.request_spaces rs ON rs.id=r.request_space_id WHERE r.id=commitment_id AND q.status='approved' AND rs.acknowledged_at IS NOT NULL) THEN RAISE EXCEPTION 'Active hold requires approved request and acknowledged version'; END IF;
 ELSIF kind='lease' THEN
  SELECT status='executed',space_version_id,occupancy_period INTO blocks_inventory,version_id,expected_period FROM leasing.leases WHERE id=commitment_id FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;
  IF blocks_inventory AND NOT EXISTS(
   SELECT 1 FROM leasing.lease_versions v JOIN leasing.leases l ON l.id=v.lease_id AND l.property_id=v.property_id
   WHERE v.lease_id=commitment_id AND v.recorded_at IS NOT NULL AND v.recorded_by IS NOT NULL
    AND v.contractual_period=l.occupancy_period AND v.space_snapshot->>'spaceVersionId'=l.space_version_id::text
    AND jsonb_typeof(v.party_snapshot)='array' AND v.party_snapshot @> jsonb_build_array(jsonb_build_object('organizationId',l.organization_id::text))
  ) THEN RAISE EXCEPTION 'Recorded lease requires actor, time, company and matching rental terms'; END IF;
 ELSE RAISE EXCEPTION 'Unknown commitment kind'; END IF;
 SELECT array_agg(slot_id ORDER BY slot_id) INTO actual_slots FROM leasing.slot_allocations WHERE released_at IS NULL AND ((kind='reservation' AND reservation_id=commitment_id) OR(kind='lease' AND lease_id=commitment_id));
 IF NOT blocks_inventory THEN IF actual_slots IS NOT NULL THEN RAISE EXCEPTION 'Inactive commitment must release allocations'; END IF;RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM leasing.space_versions WHERE id=version_id AND (published_at IS NOT NULL OR inventory_basis='approved_brochure')) THEN RAISE EXCEPTION 'Commitment requires approved inventory'; END IF;
 SELECT array_agg(slot_id ORDER BY slot_id) INTO expected_slots FROM leasing.space_members WHERE space_version_id=version_id;
 IF expected_slots IS NULL OR expected_slots IS DISTINCT FROM actual_slots THEN RAISE EXCEPTION 'Commitment must allocate all member slots'; END IF;
 IF EXISTS(SELECT 1 FROM leasing.slot_allocations WHERE released_at IS NULL AND ((kind='reservation' AND reservation_id=commitment_id) OR(kind='lease' AND lease_id=commitment_id)) AND occupancy_period IS DISTINCT FROM expected_period) THEN RAISE EXCEPTION 'Allocation periods must match commitment'; END IF;
END;$$;
COMMIT;
