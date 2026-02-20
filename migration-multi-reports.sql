-- MIGRATION: Add multi-report support
-- Run this in Supabase SQL editor to migrate existing data

-- 1. Create the reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_name TEXT,
  category_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, name)
);

CREATE INDEX IF NOT EXISTS idx_reports_vendor ON reports(vendor_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON reports FOR ALL USING (true) WITH CHECK (true);

-- 2. Add report_id columns to all data tables
ALTER TABLE monthly_product_data ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;
ALTER TABLE monthly_category_data ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;
ALTER TABLE daily_product_data ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;
ALTER TABLE sku_title_map ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;
ALTER TABLE upload_history ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;

-- 3. Create a default report for each existing vendor (using their product_name)
INSERT INTO reports (vendor_id, name, product_name, category_name, is_default)
SELECT id, COALESCE(product_name, 'Default Report'), product_name, category_name, true
FROM vendors
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE reports.vendor_id = vendors.id);

-- 4. Link all existing data to the new default report
UPDATE monthly_product_data mpd
SET report_id = r.id
FROM reports r
WHERE mpd.vendor_id = r.vendor_id AND r.is_default = true AND mpd.report_id IS NULL;

UPDATE monthly_category_data mcd
SET report_id = r.id
FROM reports r
WHERE mcd.vendor_id = r.vendor_id AND r.is_default = true AND mcd.report_id IS NULL;

UPDATE daily_product_data dpd
SET report_id = r.id
FROM reports r
WHERE dpd.vendor_id = r.vendor_id AND r.is_default = true AND dpd.report_id IS NULL;

UPDATE sku_title_map stm
SET report_id = r.id
FROM reports r
WHERE stm.vendor_id = r.vendor_id AND r.is_default = true AND stm.report_id IS NULL;

UPDATE upload_history uh
SET report_id = r.id
FROM reports r
WHERE uh.vendor_id = r.vendor_id AND r.is_default = true AND uh.report_id IS NULL;

-- 5. Update unique constraints to use report_id
-- Drop old vendor-based constraints and create new report-based ones
ALTER TABLE monthly_product_data DROP CONSTRAINT IF EXISTS monthly_product_data_vendor_id_month_sku_key;
ALTER TABLE monthly_product_data ADD CONSTRAINT monthly_product_data_report_month_sku_key UNIQUE(report_id, month, sku);

ALTER TABLE monthly_category_data DROP CONSTRAINT IF EXISTS monthly_category_data_vendor_id_month_key;
ALTER TABLE monthly_category_data ADD CONSTRAINT monthly_category_data_report_month_key UNIQUE(report_id, month);

ALTER TABLE daily_product_data DROP CONSTRAINT IF EXISTS daily_product_data_vendor_id_day_key;
ALTER TABLE daily_product_data ADD CONSTRAINT daily_product_data_report_day_key UNIQUE(report_id, day);

ALTER TABLE sku_title_map DROP CONSTRAINT IF EXISTS sku_title_map_vendor_id_sku_key;
ALTER TABLE sku_title_map ADD CONSTRAINT sku_title_map_report_sku_key UNIQUE(report_id, sku);

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS idx_product_data_report ON monthly_product_data(report_id);
CREATE INDEX IF NOT EXISTS idx_category_data_report ON monthly_category_data(report_id);
CREATE INDEX IF NOT EXISTS idx_daily_product_data_report ON daily_product_data(report_id);
CREATE INDEX IF NOT EXISTS idx_sku_title_map_report ON sku_title_map(report_id);
CREATE INDEX IF NOT EXISTS idx_upload_history_report ON upload_history(report_id);

-- 7. Remove product_name and category_name from vendors table (now on reports)
ALTER TABLE vendors DROP COLUMN IF EXISTS product_name;
ALTER TABLE vendors DROP COLUMN IF EXISTS category_name;
