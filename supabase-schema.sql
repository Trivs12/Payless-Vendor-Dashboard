-- Vendor Campaign Dashboard - Supabase Schema
-- Run this SQL in your Supabase SQL editor after creating a new project

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vendors table
CREATE TABLE vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#0070c9',
  monthly_budget NUMERIC(10,2),
  show_budget BOOLEAN DEFAULT false,
  campaign_start DATE,
  campaign_end DATE,
  product_name TEXT,
  sku_map JSONB DEFAULT '{}',
  category_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly product data (aggregated from CSV)
CREATE TABLE monthly_product_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  sku TEXT NOT NULL,
  sku_label TEXT,
  product_title TEXT,
  variant_title TEXT,
  total_sales NUMERIC(12,2) DEFAULT 0,
  net_items INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,
  prev_total_sales NUMERIC(12,2) DEFAULT 0,
  prev_net_items INTEGER DEFAULT 0,
  prev_new_customers INTEGER DEFAULT 0,
  prev_returning_customers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, month, sku)
);

-- Monthly category data (for share calculations)
CREATE TABLE monthly_category_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  total_sales NUMERIC(12,2) DEFAULT 0,
  prev_total_sales NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, month)
);

-- Daily product data (raw daily totals from CSV for daily chart view)
CREATE TABLE daily_product_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  total_sales NUMERIC(12,2) DEFAULT 0,
  net_items INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  returning_customers INTEGER DEFAULT 0,
  prev_total_sales NUMERIC(12,2) DEFAULT 0,
  prev_net_items INTEGER DEFAULT 0,
  prev_new_customers INTEGER DEFAULT 0,
  prev_returning_customers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, day)
);

-- SKU title mapping (maps SKU to current product/variant titles)
CREATE TABLE sku_title_map (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_title TEXT NOT NULL,
  variant_title TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, sku)
);

-- App settings (company logo, name, etc.)
CREATE TABLE app_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upload history
CREATE TABLE upload_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('product', 'category')),
  file_name TEXT,
  row_count INTEGER,
  date_range TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_product_data_vendor ON monthly_product_data(vendor_id);
CREATE INDEX idx_product_data_month ON monthly_product_data(month);
CREATE INDEX idx_category_data_vendor ON monthly_category_data(vendor_id);
CREATE INDEX idx_category_data_month ON monthly_category_data(month);
CREATE INDEX idx_daily_product_data_vendor ON daily_product_data(vendor_id);
CREATE INDEX idx_daily_product_data_day ON daily_product_data(day);

-- Row Level Security (optional - enable if needed)
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_product_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_category_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_product_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_title_map ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all access via service role (API routes use anon key with these policies)
CREATE POLICY "Allow all for anon" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON monthly_product_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON monthly_category_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON daily_product_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON upload_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON sku_title_map FOR ALL USING (true) WITH CHECK (true);
