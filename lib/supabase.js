import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using demo mode.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Vendor CRUD operations
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

// Data operations
export async function saveProductData(vendorId, monthlyData) {
  if (!supabase) throw new Error('Database not configured');
  // Delete existing data for this vendor then insert new
  await supabase.from('monthly_product_data').delete().eq('vendor_id', vendorId);
  const rows = [];
  for (const [month, skuData] of Object.entries(monthlyData)) {
    for (const [sku, data] of Object.entries(skuData)) {
      rows.push({
        vendor_id: vendorId,
        month,
        sku,
        sku_label: data.skuLabel || sku,
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

export async function saveCategoryData(vendorId, categoryData) {
  if (!supabase) throw new Error('Database not configured');
  await supabase.from('monthly_category_data').delete().eq('vendor_id', vendorId);
  const rows = Object.entries(categoryData).map(([month, data]) => ({
    vendor_id: vendorId,
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

export async function saveDailyProductData(vendorId, dailyTotals) {
  if (!supabase) throw new Error('Database not configured');
  // Delete existing daily data for this vendor then insert new
  await supabase.from('daily_product_data').delete().eq('vendor_id', vendorId);
  const rows = Object.entries(dailyTotals).map(([day, data]) => ({
    vendor_id: vendorId,
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

export async function getDailyProductData(vendorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('daily_product_data')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('day');
  if (error) throw error;
  return data || [];
}

export async function saveUploadHistory(vendorId, fileType, fileName, rowCount, dateRange) {
  if (!supabase) return;
  await supabase.from('upload_history').insert({
    vendor_id: vendorId,
    file_type: fileType,
    file_name: fileName,
    row_count: rowCount,
    date_range: dateRange,
  });
}

export async function getProductData(vendorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('monthly_product_data')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('month');
  if (error) throw error;
  return data || [];
}

export async function getCategoryData(vendorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('monthly_category_data')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('month');
  if (error) throw error;
  return data || [];
}

export async function getUploadHistory(vendorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('upload_history')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('uploaded_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}
