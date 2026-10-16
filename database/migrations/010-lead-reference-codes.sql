BEGIN;
SELECT set_config('app.actor_id','system:migration',true);
CREATE SEQUENCE leasing.lead_reference_code_seq AS bigint START WITH 1;
ALTER TABLE leasing.leads ADD COLUMN reference_code text;
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS number
  FROM leasing.leads
)
UPDATE leasing.leads AS leads
SET reference_code = 'LGC-' || to_char(numbered.number, 'FM00000')
FROM numbered
WHERE leads.id = numbered.id;
SELECT setval(
  'leasing.lead_reference_code_seq',
  COALESCE(MAX(substring(reference_code FROM 5)::bigint), 1),
  COUNT(*) > 0
) FROM leasing.leads;
ALTER TABLE leasing.leads
  ALTER COLUMN reference_code SET DEFAULT ('LGC-' || to_char(nextval('leasing.lead_reference_code_seq'), 'FM00000')),
  ALTER COLUMN reference_code SET NOT NULL;
ALTER SEQUENCE leasing.lead_reference_code_seq OWNED BY leasing.leads.reference_code;
GRANT USAGE, SELECT ON SEQUENCE leasing.lead_reference_code_seq TO leasing_runtime;
CREATE UNIQUE INDEX leads_reference_code_unique ON leasing.leads (reference_code);
COMMIT;
