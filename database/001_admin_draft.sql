-- Design draft, NOT applied. PostgreSQL. Implement protected server commands
-- and transaction checks before using this schema with real inventory.
BEGIN;
CREATE TABLE admin_revision (
  id smallint PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO admin_revision (id) VALUES (1);
CREATE TABLE floors (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
  name text NOT NULL
);
INSERT INTO floors SELECT value, 'Tầng ' || value FROM generate_series(1,6) value;
CREATE TABLE slots (
  id text PRIMARY KEY,
  floor_id smallint NOT NULL REFERENCES floors,
  code text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  side text NOT NULL CHECK (side IN ('west','east')),
  area_m2 numeric(12,2) NOT NULL CHECK (area_m2 > 0),
  frontage_m numeric(12,2) NOT NULL CHECK (frontage_m > 0),
  status text NOT NULL CHECK (length(status) BETWEEN 1 AND 60),
  tenant_label text NOT NULL DEFAULT '',
  UNIQUE(id,floor_id), UNIQUE(floor_id,code), UNIQUE(floor_id,position)
);
CREATE TABLE space_groups (
  id uuid PRIMARY KEY,
  floor_id smallint NOT NULL REFERENCES floors,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  status text NOT NULL CHECK (length(status) BETWEEN 1 AND 60),
  dissolved_at timestamptz,
  UNIQUE(id,floor_id)
);
CREATE TABLE space_memberships (
  group_id uuid NOT NULL,
  slot_id text NOT NULL,
  floor_id smallint NOT NULL,
  ended_at timestamptz,
  PRIMARY KEY(group_id,slot_id),
  FOREIGN KEY(group_id,floor_id) REFERENCES space_groups(id,floor_id),
  FOREIGN KEY(slot_id,floor_id) REFERENCES slots(id,floor_id)
);
CREATE UNIQUE INDEX one_active_group_per_slot ON space_memberships(slot_id) WHERE ended_at IS NULL;
CREATE TABLE leads (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  initials text NOT NULL,
  interest text NOT NULL,
  floor_id smallint NOT NULL REFERENCES floors,
  source text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (length(status) BETWEEN 1 AND 60),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 600)
);
CREATE TABLE media (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('Ảnh','Tài liệu')),
  object_key text NOT NULL UNIQUE,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  floor_id smallint REFERENCES floors,
  group_id uuid REFERENCES space_groups,
  reference boolean NOT NULL DEFAULT false,
  CHECK (group_id IS NULL OR floor_id IS NOT NULL),
  FOREIGN KEY(group_id,floor_id) REFERENCES space_groups(id,floor_id)
);
CREATE TABLE admin_command_audit (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  revision bigint NOT NULL,
  command_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_id,idempotency_key)
);
-- Merge/split server transaction: compare expectedRevision, lock affected slots,
-- validate geometry adjacency + actual lease/reservation availability, modify
-- group/membership/media, increment revision, insert audit, then COMMIT.
-- Auth, PII contacts, lease/reservation tables and storage policy need a separate
-- confirmed schema. Display status text alone MUST NOT authorize a merge.
COMMIT;
