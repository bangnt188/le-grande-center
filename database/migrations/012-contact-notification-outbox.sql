BEGIN;
SELECT set_config('app.actor_id','system:migration',true);
CREATE TABLE leasing.contact_notification_outbox (
 intake_id uuid PRIMARY KEY REFERENCES leasing.contact_intake(id),
 request_key text GENERATED ALWAYS AS ('contact:' || intake_id::text || ':zalo') STORED UNIQUE,
 payload text,
 created_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_until timestamptz,
 forwarded_at timestamptz,
 remote_id text,
 CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
 CHECK ((forwarded_at IS NULL AND payload IS NOT NULL) OR (forwarded_at IS NOT NULL AND payload IS NULL)),
 CHECK (payload IS NULL OR length(payload) BETWEEN 1 AND 2000)
);
CREATE INDEX contact_notification_outbox_pending ON leasing.contact_notification_outbox(available_at,created_at) WHERE forwarded_at IS NULL;
ALTER TABLE leasing.contact_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE leasing.contact_notification_outbox FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON leasing.contact_notification_outbox TO leasing_runtime;
CREATE POLICY intake_enqueue ON leasing.contact_notification_outbox FOR INSERT TO leasing_runtime
 WITH CHECK (current_setting('app.actor_id',true)='public:intake' AND attempts=0 AND forwarded_at IS NULL AND lease_token IS NULL
 AND EXISTS(SELECT 1 FROM leasing.contact_intake i JOIN leasing.properties p ON p.id=i.property_id WHERE i.id=intake_id AND p.code='le-grande-centre'));
CREATE POLICY notification_dispatch_read ON leasing.contact_notification_outbox FOR SELECT TO leasing_runtime
 USING (current_setting('app.actor_id',true)='system:notification-dispatch');
CREATE POLICY notification_dispatch_update ON leasing.contact_notification_outbox FOR UPDATE TO leasing_runtime
 USING (current_setting('app.actor_id',true)='system:notification-dispatch')
 WITH CHECK (current_setting('app.actor_id',true)='system:notification-dispatch');
-- Existing receipts predate this cutover and must not be replayed to sales.
-- New contacts enqueue in the same transaction as lead + intake creation.
COMMIT;
