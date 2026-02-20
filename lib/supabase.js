import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using demo mode.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ==================== Vendor CRUD ====================

export async function getVendors() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getVendorBySlug(slug) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data;
}

export async function createVendor(vendor) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('vendors')
    .insert(vendor)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVendor(id, updates) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('vendors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVendor(id) {
  if (!supabase) throw new Error('Database not configured');
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) throw error;
}

// ==================== Report CRUD ====================

export async function getReportsByVendorId(vendorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createReport(vendorId, reportData) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('reports')
    .insert({
      vendor_id: vendorId,
      name: reportData.name,
      product_name: reportData.product_name || null,
      category_name: reportData.category_name || null,
      is_default: reportData.is_default || false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReport(reportId, updates) {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('reports')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReport(reportId) {
  if (!supabase) throw new Error('Database not configured');
  const { error } = await supabase.from('reports').delete().eq('id', reportId);
  if (error) throw error;
}

export async function setDefaultReport(vendorId, reportId) {
  if (!supabase) throw new Error('Database not configured');
  // Unset all defaults for this vendor
  await supabase
    .from('reports')
    .update({ is_default: false })
    .eq('vendor_id', vendorId);
  // Set the new default
  const { error } = await supabase
    .from('reports')
    .update({ is_default: true })
    .eq('id', reportId);
  if (error) throw error;
}

// ==================== Data operations (all use reportId) ====================

export async function saveProductData(reportId, monthlyData) {
  if (!supabase) throw new Error('Database not configured');
  // Delete existing data for this report then insert new
  await supabase.from('monthly_product_data').delete().eq('report_id', reportId);
  const rows = [];
  for (const [month, skuData] of Object.entries(monthlyData)) {
    for (const [sku, data] of Object.entries(skuData)) {
      rows.push({
        report_id: reportId,
        month,
        sku,
        sku_label: data.skuLabel || sku,
        product_title: data.productTitle || null,
        variant_title: data.variantTitle || null,
        total_sales: data.totalSales || 0,
        net_items: data.netItems || 0,
        new_customers: data.newCustomers || 0,
        returning_customers: data.returningCustomers || 0,
        prev_total_sales: data.prevTotalSales || 0,
        prev_net_items: data.prevNetItems || 0,
        prev_new_customers: data.prevNewCustomers || 0,
        prev_returning_customers: data.prevReturningCustomers || 0,
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('monthly_product_data').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

export async function saveCategoryData(reportId, categoryData) {
  if (!supabase) throw new Error('Database not configured');
  await supabase.from('monthly_category_data').delete().eq('report_id', reportId);
  const rows = Object.entries(categoryData).map(([month, data]) => ({
    report_id: reportId,
    month,
    total_sales: data.totalSales || 0,
    prev_total_sales: data.prevTotalSales || 0,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from('monthly_category_data').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

export async function saveDailyProductData(reportId, dailyTotals) {
  if (!supabase) throw new Error('Database not configured');
  await supabase.from('daily_product_data').delete().eq('report_id', reportId);
  const rows = Object.entries(dailyTotals).map(([day, data]) => ({
    report_id: reportId,
    day,
    total_sales: data.totalSales || 0,
    net_items: data.netItems || 0,
    new_customers: data.newCustomers || 0,
    returning_customers: data.returningCustomers || 0,
    prev_total_sales: data.prevTotalSales || 0,
    prev_net_items: data.prevNetItems || 0,
    prev_new_customers: data.prevNewCustomers || 0,
    prev_returning_customers: data.prevReturningCustomers || 0,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from('daily_product_data').insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

export async function getDailyProductData(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('daily_product_data')
    .select('*')
    .eq('report_id', reportId)
    .order('day');
  if (error) throw error;
  return data || [];
}

export async function getProductData(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('monthly_product_data')
    .select('*')
    .eq('report_id', reportId)
    .order('month');
  if (error) throw error;
  return data || [];
}

export async function getCategoryData(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('monthly_category_data')
    .select('*')
    .eq('report_id', reportId)
    .order('month');
  if (error) throw error;
  return data || [];
}

// ==================== SKU title mapping (all use reportId) ====================

export async function getSkuTitleMap(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sku_title_map')
    .select('*')
    .eq('report_id', reportId)
    .order('product_title');
  if (error) throw error;
  return data || [];
}

export async function saveSkuTitleMap(reportId, mappings) {
  if (!supabase) throw new Error('Database not configured');
  const rows = mappings.map((m) => ({
    report_id: reportId,
    sku: m.sku,
    product_title: m.product_title,
    variant_title: m.variant_title || null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await supabase
      .from('sku_title_map')
      .upsert(rows, { onConflict: 'report_id,sku' });
    if (error) throw error;
  }
}

export async function deleteSkuTitleMapping(reportId, sku) {
  if (!supabase) throw new Error('Database not configured');
  const { error } = await supabase
    .from('sku_title_map')
    .delete()
    .eq('report_id', reportId)
    .eq('sku', sku);
  if (error) throw error;
}

// ==================== Upload history (uses reportId) ====================

export async function saveUploadHistory(reportId, fileType, fileName, rowCount, dateRange) {
  if (!supabase) return;
  await supabase.from('upload_history').insert({
    report_id: reportId,
    file_type: fileType,
    file_name: fileName,
    row_count: rowCount,
    date_range: dateRange,
  });
}

export async function getUploadHistory(reportId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('upload_history')
    .select('*')
    .eq('report_id', reportId)
    .order('uploaded_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

// ==================== App settings ====================

export async function getAppSetting(key) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error) return null;
  return data?.value || null;
}

export async function saveAppSetting(key, value) {
  if (!supabase) throw new Error('Database not configured');
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}
