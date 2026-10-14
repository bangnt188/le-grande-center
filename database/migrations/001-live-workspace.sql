BEGIN;
SELECT set_config('app.actor_id','system:migration',true);
ALTER TABLE leasing.properties ADD COLUMN workspace_revision bigint NOT NULL DEFAULT 0 CHECK(workspace_revision>=0);
ALTER TABLE leasing.properties ADD COLUMN contact_email text NOT NULL DEFAULT '', ADD COLUMN contact_phone text NOT NULL DEFAULT '', ADD COLUMN default_hold_hours integer NOT NULL DEFAULT 48 CHECK(default_hold_hours BETWEEN 1 AND 720), ADD COLUMN appointment_minutes integer NOT NULL DEFAULT 30 CHECK(appointment_minutes BETWEEN 15 AND 240), ADD COLUMN appointment_location text NOT NULL DEFAULT 'Le Grande Centre';
CREATE TABLE leasing.website_settings (
 property_id uuid PRIMARY KEY REFERENCES leasing.properties, logo_media_id uuid REFERENCES leasing.document_versions,
 email text NOT NULL, hotline text NOT NULL, secondary_phone text NOT NULL DEFAULT '',management_phone text NOT NULL DEFAULT '',address text NOT NULL,zalo_url text NOT NULL);
CREATE TABLE leasing.admin_allowlist (property_id uuid NOT NULL REFERENCES leasing.properties,email text NOT NULL,user_id uuid REFERENCES leasing.users,revoked_at timestamptz,PRIMARY KEY(property_id,email),UNIQUE(user_id));
ALTER TABLE leasing.floors ADD COLUMN purpose text NOT NULL DEFAULT '',ADD COLUMN public_title text NOT NULL DEFAULT '',ADD COLUMN public_description text NOT NULL DEFAULT '';
ALTER TABLE leasing.organizations ADD COLUMN industry text NOT NULL DEFAULT '',ADD COLUMN account_owner text NOT NULL DEFAULT '',ADD COLUMN internal_note text NOT NULL DEFAULT '';
ALTER TABLE leasing.slots ADD COLUMN operational_status text NOT NULL DEFAULT 'Trống' CHECK(operational_status IN ('Trống','Đang thuê')),ADD COLUMN tenant_label text NOT NULL DEFAULT '';
ALTER TABLE leasing.spaces ADD COLUMN is_admin_group boolean NOT NULL DEFAULT false;
ALTER TABLE leasing.slot_versions ALTER COLUMN geometry DROP NOT NULL;
ALTER TABLE leasing.space_versions ALTER COLUMN geometry DROP NOT NULL;
ALTER TABLE leasing.space_versions ADD COLUMN inventory_basis text NOT NULL DEFAULT 'unconfirmed' CHECK(inventory_basis IN ('unconfirmed','approved_brochure','validated_plan'));
ALTER TABLE leasing.reservations ADD COLUMN internal_note text NOT NULL DEFAULT '';
CREATE TABLE leasing.leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES leasing.properties,organization_id uuid,name text NOT NULL,interest text NOT NULL,floor_number smallint NOT NULL CHECK(floor_number BETWEEN 1 AND 6),source text NOT NULL,status text NOT NULL CHECK(status IN ('Mới','Đang tư vấn','Đã xử lý')),note text NOT NULL DEFAULT '',email text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',FOREIGN KEY(property_id,organization_id) REFERENCES leasing.property_customers);
CREATE TABLE leasing.contact_intake (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES leasing.properties,idempotency_key text NOT NULL UNIQUE,request_sha256 char(64) NOT NULL,ip_hash char(64) NOT NULL,lead_id uuid NOT NULL REFERENCES leasing.leads,intent text NOT NULL CHECK(intent IN ('consultation','visit','callback')),company_name text NOT NULL,business text NOT NULL,area_preference text NOT NULL,timing text NOT NULL,space_code text NOT NULL,scope text,visit_date date,visit_time text,consented_at timestamptz NOT NULL DEFAULT now());
-- Existing UI records a file and rental; it does not certify a signature or extract financial terms.
ALTER TABLE leasing.lease_versions RENAME COLUMN signed_at TO recorded_at;
ALTER TABLE leasing.lease_versions RENAME COLUMN executed_by TO recorded_by;
ALTER TABLE leasing.lease_versions ALTER COLUMN currency DROP NOT NULL,ALTER COLUMN rent_amount DROP NOT NULL,ALTER COLUMN rent_basis DROP NOT NULL,ALTER COLUMN tax_terms DROP NOT NULL;
ALTER TABLE leasing.lease_versions ADD COLUMN rent_note text NOT NULL DEFAULT 'Theo tài liệu đã tải lên';
DROP TRIGGER immutable_signed_terms ON leasing.lease_versions;
CREATE TRIGGER immutable_recorded_terms BEFORE UPDATE OR DELETE ON leasing.lease_versions FOR EACH ROW EXECUTE FUNCTION leasing.reject_frozen_version_change('recorded_at');
DROP TRIGGER immutable_lease_links ON leasing.lease_documents;
CREATE TRIGGER immutable_lease_links BEFORE INSERT OR UPDATE OR DELETE ON leasing.lease_documents FOR EACH ROW EXECUTE FUNCTION leasing.reject_frozen_child_change('lease_versions','lease_version_id','recorded_at');
ALTER TABLE leasing.lease_documents DROP CONSTRAINT lease_documents_purpose_check;
ALTER TABLE leasing.lease_documents ADD CONSTRAINT lease_documents_purpose_check CHECK(purpose IN ('recorded_original','attachment'));
UPDATE leasing.workflow_statuses SET label='Đã ghi nhận' WHERE domain='lease' AND code='executed';
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
  IF blocks_inventory AND NOT EXISTS(SELECT 1 FROM leasing.lease_versions v JOIN leasing.lease_documents ld ON ld.lease_version_id=v.id AND ld.purpose='recorded_original' JOIN leasing.document_versions dv ON dv.id=ld.document_version_id JOIN leasing.documents d ON d.id=dv.document_id JOIN leasing.leases l ON l.id=v.lease_id WHERE v.lease_id=commitment_id AND v.recorded_at IS NOT NULL AND (dv.scan_state='clean' OR dv.manual_reviewed_by IS NOT NULL) AND dv.sealed_at IS NOT NULL AND dv.content_type='application/pdf' AND d.classification='contract_private' AND d.organization_id=l.organization_id) THEN RAISE EXCEPTION 'Recorded lease requires a released sealed private PDF of its company'; END IF;
 ELSE RAISE EXCEPTION 'Unknown commitment kind'; END IF;
 SELECT array_agg(slot_id ORDER BY slot_id) INTO actual_slots FROM leasing.slot_allocations WHERE released_at IS NULL AND ((kind='reservation' AND reservation_id=commitment_id) OR(kind='lease' AND lease_id=commitment_id));
 IF NOT blocks_inventory THEN IF actual_slots IS NOT NULL THEN RAISE EXCEPTION 'Inactive commitment must release allocations'; END IF;RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM leasing.space_versions WHERE id=version_id AND (published_at IS NOT NULL OR inventory_basis='approved_brochure')) THEN RAISE EXCEPTION 'Commitment requires approved inventory'; END IF;
 SELECT array_agg(slot_id ORDER BY slot_id) INTO expected_slots FROM leasing.space_members WHERE space_version_id=version_id;
 IF expected_slots IS NULL OR expected_slots IS DISTINCT FROM actual_slots THEN RAISE EXCEPTION 'Commitment must allocate all member slots'; END IF;
 IF EXISTS(SELECT 1 FROM leasing.slot_allocations WHERE released_at IS NULL AND ((kind='reservation' AND reservation_id=commitment_id) OR(kind='lease' AND lease_id=commitment_id)) AND occupancy_period IS DISTINCT FROM expected_period) THEN RAISE EXCEPTION 'Allocation periods must match commitment'; END IF;
END;$$;
CALL row_audit.apply('leasing',ARRAY['website_settings','admin_allowlist','leads','contact_intake'],'system:migration');
-- Runtime is explicitly non-owner; only trusted server code can set transaction actor.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='leasing_runtime') THEN CREATE ROLE leasing_runtime NOLOGIN NOBYPASSRLS; END IF; EXECUTE format('GRANT leasing_runtime TO %I',current_user); END $$;
GRANT USAGE ON SCHEMA leasing,row_audit TO leasing_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA leasing TO leasing_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA leasing,row_audit TO leasing_runtime;
DO $$ DECLARE t text;BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='leasing' LOOP EXECUTE format('ALTER TABLE leasing.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY trusted_server_transaction ON leasing.%I TO leasing_runtime USING (coalesce(current_setting(''app.actor_id'',true),'''')<>'''') WITH CHECK (coalesce(current_setting(''app.actor_id'',true),'''')<>'''')',t);END LOOP;END $$;
COMMIT;
