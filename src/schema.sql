CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS system_settings(key TEXT PRIMARY KEY,value JSONB NOT NULL DEFAULT '{}',updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS roles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT UNIQUE NOT NULL,permissions JSONB NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS users(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,full_name TEXT NOT NULL DEFAULT '',role_id UUID REFERENCES roles(id),active BOOLEAN DEFAULT true,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS centers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,active BOOLEAN DEFAULT true);
CREATE TABLE IF NOT EXISTS services(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE NOT NULL,name_ar TEXT NOT NULL,name_en TEXT NOT NULL,active BOOLEAN DEFAULT true,sort_order INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS beneficiaries(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),external_id TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,gender TEXT,birth_date DATE,population_group TEXT,center_id UUID REFERENCES centers(id),support_start_date DATE,metadata JSONB DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS forms(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),service_id UUID REFERENCES services(id),name TEXT NOT NULL,description TEXT DEFAULT '',status TEXT DEFAULT 'draft',current_version INT DEFAULT 1,code TEXT,form_type TEXT NOT NULL DEFAULT 'service',source_system TEXT NOT NULL DEFAULT 'native',source_metadata JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS form_versions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),form_id UUID REFERENCES forms(id) ON DELETE CASCADE,version INT NOT NULL,schema_json JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(form_id,version));
CREATE TABLE IF NOT EXISTS submissions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),form_id UUID REFERENCES forms(id),form_version INT NOT NULL,beneficiary_id UUID REFERENCES beneficiaries(id),submitted_by UUID REFERENCES users(id),answers JSONB NOT NULL DEFAULT '{}',status TEXT DEFAULT 'submitted',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS tasks(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),beneficiary_id UUID REFERENCES beneficiaries(id),title TEXT NOT NULL,due_date DATE,status TEXT DEFAULT 'open',assigned_to UUID REFERENCES users(id),metadata JSONB DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS referrals(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),beneficiary_id UUID REFERENCES beneficiaries(id),submission_id UUID REFERENCES submissions(id),destination TEXT,status TEXT DEFAULT 'open',referred_at DATE DEFAULT CURRENT_DATE,completed_at DATE,notes TEXT DEFAULT '');
-- Forward-compatible migration for databases created by earlier CWD versions.
-- CREATE TABLE IF NOT EXISTS does not add new columns to an existing table,
-- so add every newer forms column before indexes or application queries use it.
ALTER TABLE forms ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS form_type TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS source_metadata JSONB;

UPDATE forms SET form_type='service' WHERE form_type IS NULL;
UPDATE forms SET source_system='native' WHERE source_system IS NULL;
UPDATE forms SET source_metadata='{}'::jsonb WHERE source_metadata IS NULL;

ALTER TABLE forms ALTER COLUMN form_type SET DEFAULT 'service';
ALTER TABLE forms ALTER COLUMN source_system SET DEFAULT 'native';
ALTER TABLE forms ALTER COLUMN source_metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE forms ALTER COLUMN form_type SET NOT NULL;
ALTER TABLE forms ALTER COLUMN source_system SET NOT NULL;
ALTER TABLE forms ALTER COLUMN source_metadata SET NOT NULL;

CREATE TABLE IF NOT EXISTS organizational_units(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),unit_type TEXT NOT NULL,name TEXT NOT NULL,parent_id UUID REFERENCES organizational_units(id),active BOOLEAN DEFAULT true,metadata JSONB DEFAULT '{}');
CREATE TABLE IF NOT EXISTS task_rules(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,form_code TEXT,rule_json JSONB NOT NULL DEFAULT '{}',active BOOLEAN DEFAULT true);
CREATE TABLE IF NOT EXISTS indicators(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,definition_json JSONB NOT NULL DEFAULT '{}',active BOOLEAN DEFAULT true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_source_code ON forms(source_system,code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_beneficiary ON submissions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date,status);

CREATE TABLE IF NOT EXISTS volunteers(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), volunteer_no INT UNIQUE, name TEXT NOT NULL,
 governorate TEXT, area TEXT, latitude NUMERIC, longitude NUMERIC, gps_confirmed BOOLEAN,
 mobile TEXT, has_smartphone BOOLEAN, facilitator_name TEXT, cbhs_id TEXT UNIQUE,
 active BOOLEAN DEFAULT true, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS volunteer_activities(
 volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE, activity_code TEXT NOT NULL,
 active BOOLEAN DEFAULT true, PRIMARY KEY(volunteer_id,activity_code)
);
CREATE TABLE IF NOT EXISTS volunteer_equipment(
 volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE, equipment_code TEXT NOT NULL,
 status TEXT, notes TEXT, PRIMARY KEY(volunteer_id,equipment_code)
);
CREATE TABLE IF NOT EXISTS training_catalog(
 code TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INT DEFAULT 0, active BOOLEAN DEFAULT true
);
CREATE TABLE IF NOT EXISTS volunteer_trainings(
 volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE, training_code TEXT REFERENCES training_catalog(code),
 status TEXT NOT NULL DEFAULT 'not_trained', trained_at DATE, PRIMARY KEY(volunteer_id,training_code)
);
CREATE INDEX IF NOT EXISTS idx_volunteers_governorate ON volunteers(governorate);
