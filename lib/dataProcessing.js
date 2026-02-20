import Papa from 'papaparse';

/**
 * Parse numeric values, returning 0 for empty or invalid values
 */
function parseNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract YYYY-MM from a date string (handles various formats)
 */
function extractMonth(dateStr) {
  if (!dateStr) return null;
  // Try to match YYYY-MM-DD or similar formats
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  // Try MM/DD/YYYY format
  const match2 = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match2) {
    return `${match2[3]}-${String(match2[1]).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Parse Product CSV data
 * Returns monthly aggregated SKU data with current and previous year metrics
 */
export function parseProductCSV(csvText, skuMap = {}) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing errors:', result.errors);
  }

  const monthlySkuData = {};
  const monthlyTotals = {};
  const targetSkusSet = new Set();
  const monthsSet = new Set();

  // First pass: collect all target SKUs
  result.data.forEach((row) => {
    const sku = row['Product variant SKU'];
    if (sku && sku.trim()) {
      targetSkusSet.add(sku);
    }
  });

  const targetSkus = Array.from(targetSkusSet).sort();

  // Second pass: aggregate data by month
  result.data.forEach((row) => {
    const month = extractMonth(row['Day']);
    if (!month) return;

    monthsSet.add(month);
    const sku = row['Product variant SKU'];

    if (!sku || !sku.trim()) return;

    const totalSales = parseNumeric(row['Total sales']);
    const netItems = parseNumeric(row['Net items sold']);
    const newCustomers = parseNumeric(row['New customers']);
    const returningCustomers = parseNumeric(row['Returning customers']);

    const prevTotalSales = parseNumeric(row['Total sales (previous_year)']);
    const prevNetItems = parseNumeric(row['Net items sold (previous_year)']);
    const prevNewCustomers = parseNumeric(row['New customers (previous_year)']);
    const prevReturningCustomers = parseNumeric(row['Returning customers (previous_year)']);

    // Initialize month data if needed
    if (!monthlySkuData[month]) {
      monthlySkuData[month] = {};
    }

    // Initialize SKU data for this month
    if (!monthlySkuData[month][sku]) {
      monthlySkuData[month][sku] = {
        totalSales: 0,
        netItems: 0,
        newCustomers: 0,
        returningCustomers: 0,
        prevTotalSales: 0,
        prevNetItems: 0,
        prevNewCustomers: 0,
        prevReturningCustomers: 0,
        skuLabel: skuMap[sku] || sku,
      };
    }

    // Aggregate monthly data
    monthlySkuData[month][sku].totalSales += totalSales;
    monthlySkuData[month][sku].netItems += netItems;
    monthlySkuData[month][sku].newCustomers += newCustomers;
    monthlySkuData[month][sku].returningCustomers += returningCustomers;
    monthlySkuData[month][sku].prevTotalSales += prevTotalSales;
    monthlySkuData[month][sku].prevNetItems += prevNetItems;
    monthlySkuData[month][sku].prevNewCustomers += prevNewCustomers;
    monthlySkuData[month][sku].prevReturningCustomers += prevReturningCustomers;
  });

  // Ensure all target SKUs exist in all months
  const months = Array.from(monthsSet).sort();
  months.forEach((month) => {
    if (!monthlySkuData[month]) {
      monthlySkuData[month] = {};
    }
    targetSkus.forEach((sku) => {
      if (!monthlySkuData[month][sku]) {
        monthlySkuData[month][sku] = {
          totalSales: 0,
          netItems: 0,
          newCustomers: 0,
          returningCustomers: 0,
          prevTotalSales: 0,
          prevNetItems: 0,
          prevNewCustomers: 0,
          prevReturningCustomers: 0,
          skuLabel: skuMap[sku] || sku,
        };
      }
    });
  });

  // Calculate monthly totals
  months.forEach((month) => {
    let totalSales = 0;
    let netItems = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let prevTotalSales = 0;
    let prevNetItems = 0;
    let prevNewCustomers = 0;
    let prevReturningCustomers = 0;

    Object.values(monthlySkuData[month]).forEach((skuData) => {
      totalSales += skuData.totalSales;
      netItems += skuData.netItems;
      newCustomers += skuData.newCustomers;
      returningCustomers += skuData.returningCustomers;
      prevTotalSales += skuData.prevTotalSales;
      prevNetItems += skuData.prevNetItems;
      prevNewCustomers += skuData.prevNewCustomers;
      prevReturningCustomers += skuData.prevReturningCustomers;
    });

    monthlyTotals[month] = {
      totalSales,
      netItems,
      newCustomers,
      returningCustomers,
      prevTotalSales,
      prevNetItems,
      prevNewCustomers,
      prevReturningCustomers,
    };
  });

  return {
    monthlySkuData,
    monthlyTotals,
    months,
    targetSkus,
  };
}

/**
 * Parse Category CSV data
 * Returns monthly totals with current and previous year sales
 */
export function parseCategoryCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing errors:', result.errors);
  }

  const monthlyData = {};
  const monthsSet = new Set();

  result.data.forEach((row) => {
    const month = extractMonth(row['Day']);
    if (!month) return;

    monthsSet.add(month);

    const totalSales = parseNumeric(row['Total sales']);
    const prevTotalSales = parseNumeric(row['Total sales (previous_year)']);

    if (!monthlyData[month]) {
      monthlyData[month] = {
        totalSales: 0,
        prevTotalSales: 0,
      };
    }

    monthlyData[month].totalSales += totalSales;
    monthlyData[month].prevTotalSales += prevTotalSales;
  });

  return monthlyData;
}

/**
 * Calculate Month-over-Month comparisons
 * Compares consecutive months in the data
 */
export function calculateMoM(monthlyTotals, monthlySkuData, months) {
  const comparisons = [];

  for (let i = 1; i < months.length; i++) {
    const month1 = months[i - 1];
    const month2 = months[i];

    const month1Data = monthlyTotals[month1];
    const month2Data = monthlyTotals[month2];

    const change = {
      totalSales: month2Data.totalSales - month1Data.totalSales,
      netItems: month2Data.netItems - month1Data.netItems,
      newCustomers: month2Data.newCustomers - month1Data.newCustomers,
      returningCustomers: month2Data.returningCustomers - month1Data.returningCustomers,
    };

    // Calculate SKU-level comparisons
    const skuComparison = {};
    const skus = Object.keys(monthlySkuData[month2] || {});
    skus.forEach((sku) => {
      const data1 = monthlySkuData[month1]?.[sku] || {
        totalSales: 0,
        netItems: 0,
      };
      const data2 = monthlySkuData[month2]?.[sku] || {
        totalSales: 0,
        netItems: 0,
      };

      skuComparison[sku] = {
        sales1: data1.totalSales,
        sales2: data2.totalSales,
        change: data2.totalSales - data1.totalSales,
        items1: data1.netItems,
        items2: data2.netItems,
        itemsChange: data2.netItems - data1.netItems,
      };
    });

    comparisons.push({
      month1,
      month2,
      month1Data,
      month2Data,
      change,
      skuComparison,
    });
  }

  return comparisons;
}

/**
 * Calculate Year-over-Year comparisons
 * Compares current month to previous year same month
 */
export function calculateYoY(monthlyTotals, monthlySkuData, months) {
  const comparisons = [];

  months.forEach((month) => {
    const data = monthlyTotals[month];

    const change = {
      totalSales: data.totalSales - data.prevTotalSales,
      netItems: data.netItems - data.prevNetItems,
      newCustomers: data.newCustomers - data.prevNewCustomers,
      returningCustomers: data.returningCustomers - data.prevReturningCustomers,
    };

    // Calculate SKU-level comparisons
    const skuData = {};
    Object.entries(monthlySkuData[month] || {}).forEach(([sku, skuMetrics]) => {
      skuData[sku] = {
        current: skuMetrics.totalSales,
        previous: skuMetrics.prevTotalSales,
        change: skuMetrics.totalSales - skuMetrics.prevTotalSales,
        currentItems: skuMetrics.netItems,
        previousItems: skuMetrics.prevNetItems,
        itemsChange: skuMetrics.netItems - skuMetrics.prevNetItems,
      };
    });

    comparisons.push({
      month,
      current: data.totalSales,
      previous: data.prevTotalSales,
      change,
      skuData,
    });
  });

  return comparisons;
}

/**
 * Calculate campaign period totals
 * Aggregates all months for overall campaign summary
 */
export function calculateCampaignPeriod(monthlyTotals, monthlySkuData, months, categoryData = {}) {
  let totalSales = 0;
  let netItems = 0;
  let newCustomers = 0;
  let returningCustomers = 0;
  let prevTotalSales = 0;
  let prevNetItems = 0;
  let prevNewCustomers = 0;
  let prevReturningCustomers = 0;

  months.forEach((month) => {
    const data = monthlyTotals[month];
    totalSales += data.totalSales;
    netItems += data.netItems;
    newCustomers += data.newCustomers;
    returningCustomers += data.returningCustomers;
    prevTotalSales += data.prevTotalSales;
    prevNetItems += data.prevNetItems;
    prevNewCustomers += data.prevNewCustomers;
    prevReturningCustomers += data.prevReturningCustomers;
  });

  // Calculate category share if category data is provided
  let categoryTotalSales = 0;
  let categoryPrevTotalSales = 0;
  Object.values(categoryData).forEach((data) => {
    categoryTotalSales += data.totalSales;
    categoryPrevTotalSales += data.prevTotalSales;
  });

  const categoryShare = categoryTotalSales > 0 ? (totalSales / categoryTotalSales) * 100 : 0;
  const prevCategoryShare = categoryPrevTotalSales > 0 ? (prevTotalSales / categoryPrevTotalSales) * 100 : 0;

  // Aggregate SKU performance
  const skuSummary = {};
  Object.keys(monthlySkuData).forEach((month) => {
    Object.entries(monthlySkuData[month]).forEach(([sku, data]) => {
      if (!skuSummary[sku]) {
        skuSummary[sku] = {
          totalSales: 0,
          netItems: 0,
          newCustomers: 0,
          returningCustomers: 0,
          prevTotalSales: 0,
          prevNetItems: 0,
          prevNewCustomers: 0,
          prevReturningCustomers: 0,
          skuLabel: data.skuLabel,
        };
      }
      skuSummary[sku].totalSales += data.totalSales;
      skuSummary[sku].netItems += data.netItems;
      skuSummary[sku].newCustomers += data.newCustomers;
      skuSummary[sku].returningCustomers += data.returningCustomers;
      skuSummary[sku].prevTotalSales += data.prevTotalSales;
      skuSummary[sku].prevNetItems += data.prevNetItems;
      skuSummary[sku].prevNewCustomers += data.prevNewCustomers;
      skuSummary[sku].prevReturningCustomers += data.prevReturningCustomers;
    });
  });

  return {
    period: `${months[0]} to ${months[months.length - 1]}`,
    totalSales,
    netItems,
    newCustomers,
    returningCustomers,
    prevTotalSales,
    prevNetItems,
    prevNewCustomers,
    prevReturningCustomers,
    change: {
      totalSales: totalSales - prevTotalSales,
      netItems: netItems - prevNetItems,
      newCustomers: newCustomers - prevNewCustomers,
      returningCustomers: returningCustomers - prevReturningCustomers,
    },
    categoryShare,
    prevCategoryShare,
    categoryShareChange: categoryShare - prevCategoryShare,
    skuSummary,
  };
}

/**
 * Format value as CAD currency
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Calculate percentage change
 * Returns formatted percentage string
 * Returns "N/A" if previous is 0 and current is greater than 0
 * Returns "0%" if both values are 0
 */
export function formatPercent(current, previous) {
  if (previous === 0 && current === 0) {
    return '0%';
  }
  if (previous === 0 && current > 0) {
    return 'N/A';
  }
  if (previous === 0) {
    return 'N/A';
  }

  const percentChange = ((current - previous) / previous) * 100;
  const sign = percentChange >= 0 ? '+' : '';
  return `${sign}${percentChange.toFixed(1)}%`;
}
