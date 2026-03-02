'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  getVendorBySlug,
  getReportsByVendorId,
  getProductData,
  getCategoryData,
  getDailyProductData,
  getAppSetting,
  getSkuTitleMap,
  getCustomerData,
} from '@/lib/supabase';
import {
  calculateYoY,
  calculateMoM,
  calculateCampaignPeriod,
  formatCurrency,
  formatPercent,
} from '@/lib/dataProcessing';
import {
  generateYoYInsights,
  generateMoMInsights,
  generateCampaignInsights,
  generateCategoryInsights,
  generateExecutiveSummary,
} from '@/lib/insights';

// html2canvas and jsPDF loaded dynamically when needed (not React components)

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BRAND_COLORS = {
  current: '#17A5EB',
  previous: '#88C6E6',
};

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="h-32 bg-slate-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-slate-200 rounded-lg animate-pulse" />
    </div>
  </div>
);

// Error state component
const ErrorState = ({ message }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
    <div className="card max-w-md text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
      <p className="text-slate-600 mb-6">{message}</p>
      <a
        href="/"
        className="btn-primary inline-block"
      >
        Back to Home
      </a>
    </div>
  </div>
);

// No data state component
const NoDataState = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
    <div className="card max-w-md text-center">
      <div className="text-6xl mb-4">📊</div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">No Data Available</h2>
      <p className="text-slate-600">
        No data has been uploaded yet. Please contact your account manager to upload the latest campaign data.
      </p>
    </div>
  </div>
);

// KPI Card component
const KPICard = ({ title, value, previousValue, isPercentage = false, isCurrency = false }) => {
  let change = 0;
  let changePercent = 'N/A';
  let growthClass = 'growth-neutral';

  if (previousValue && previousValue !== 0) {
    change = value - previousValue;
    changePercent = formatPercent(value, previousValue);
    if (change > 0) {
      growthClass = 'growth-positive';
    } else if (change < 0) {
      growthClass = 'growth-negative';
    }
  } else if (previousValue === 0 && value > 0) {
    growthClass = 'growth-positive';
    changePercent = '+∞';
  }

  const displayValue = isCurrency ? formatCurrency(value) : isPercentage ? `${value.toLocaleString()}%` : value.toLocaleString();
  const arrow =
    changePercent === 'N/A'
      ? '→'
      : changePercent.startsWith('+')
      ? '↑'
      : changePercent.startsWith('-')
      ? '↓'
      : '→';

  return (
    <div className="kpi-card">
      <h3 className="text-slate-600 text-sm font-medium mb-2">{title}</h3>
      <div className="text-3xl font-bold text-slate-900 mb-2">{displayValue}</div>
      <div className={`text-sm font-semibold ${growthClass}`}>
        {arrow} {changePercent}
      </div>
      {previousValue !== undefined && (
        <div className="text-xs text-slate-500 mt-2">
          Previous Year: {isCurrency ? formatCurrency(previousValue) : isPercentage ? `${previousValue.toLocaleString()}%` : previousValue.toLocaleString()}
        </div>
      )}
    </div>
  );
};

// Insight box component - handles both string and array inputs
const InsightBox = ({ insights }) => {
  if (!insights) return null;
  const text = typeof insights === 'string' ? insights : Array.isArray(insights) ? insights.join(' ') : String(insights);
  if (!text || text.length === 0) return null;
  return (
    <div className="insight-box mb-6">
      <h3 className="text-lg font-bold text-slate-800 mb-3">Key Insights</h3>
      <p className="text-slate-700 text-sm leading-relaxed">{text}</p>
    </div>
  );
};

// Tab navigation component
const TabNavigation = ({ tabs, activeTab, setActiveTab }) => (
  <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
          activeTab === tab
            ? 'text-blue-600 border-blue-600'
            : 'text-slate-600 border-transparent hover:text-slate-900'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

// Helper: format YYYY-MM to "September 2025"
const formatMonthTitle = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

// Abbreviated: "Sept 2025", "Oct 2025"
const formatMonthShort = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

// Helper: parse display value for sorting (extract number from formatted strings)
const parseSortValue = (value) => {
  if (value === null || value === undefined || value === '—') return -Infinity;
  if (typeof value === 'number') return value;
  const str = String(value);
  // Currency: $1,234 or $1,234.56
  const currency = str.replace(/[$,CAD\s]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(currency) && str.includes('$')) return parseFloat(currency);
  // Percentage: +12.3% or -5.0% or 12%
  const pctMatch = str.match(/^([+-]?\d+(\.\d+)?)%$/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  // Plain number with commas: 1,234
  const plain = str.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(plain)) return parseFloat(plain);
  // Fallback: string comparison
  return str.toLowerCase();
};

// Helper: get number of days in a month from YYYY-MM string
const getDaysInMonth = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

// Data table component with sorting and group-by-product
const DataTable = ({ columns, rows, className = '', enableGrouping = false, footerRows = [] }) => {
  const [sortCol, setSortCol] = React.useState(null);
  const [sortDir, setSortDir] = React.useState('asc');
  const [groupByProduct, setGroupByProduct] = React.useState(false);
  const [collapsedGroups, setCollapsedGroups] = React.useState({});
  const [colWidths, setColWidths] = React.useState({});
  const resizingRef = React.useRef(null);

  const hasProductColumn = columns.includes('Product');

  // Determine if a column should be right-aligned (numeric, currency, percentage columns)
  const isRightAligned = (col) => {
    const lower = col.toLowerCase();
    return lower.includes('sales') || lower.includes('units') || lower.includes('items') ||
      lower.includes('change') || lower.includes('share') || lower.includes('total') ||
      lower.includes('customers') || lower.includes('month') && !lower.includes('month') === false;
  };
  // More precise: right-align everything except SKU, Product, Variant, Month (label)
  const getAlignment = (col) => {
    const lower = col.toLowerCase();
    if (lower === 'sku' || lower === 'product' || lower === 'variant' || lower === 'month') return 'text-left';
    return 'text-right';
  };

  const getCellClass = (col, value) => {
    const align = getAlignment(col);
    if (typeof value !== 'string') return `text-slate-700 ${align}`;
    if (col.toLowerCase().includes('change') || col.toLowerCase().includes('share')) {
      if (value.startsWith('+') && value !== '+0.0%') return `text-emerald-600 font-semibold ${align}`;
      if (value.startsWith('-')) return `text-red-600 font-semibold ${align}`;
    }
    return `text-slate-700 ${align}`;
  };

  const handleSort = (col) => {
    if (resizingRef.current) return; // don't sort while resizing
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleResizeStart = (col, e) => {
    e.preventDefault();
    e.stopPropagation();
    const th = e.target.parentElement;
    const startX = e.clientX;
    const startWidth = th.offsetWidth;
    resizingRef.current = col;

    const onMouseMove = (moveE) => {
      const diff = moveE.clientX - startX;
      const newWidth = Math.max(60, startWidth + diff);
      setColWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => { resizingRef.current = null; }, 0);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Collapse all groups by default when grouping is enabled
  React.useEffect(() => {
    if (groupByProduct && hasProductColumn) {
      const allProducts = {};
      rows.forEach((row) => {
        const product = row['Product'] || 'Other';
        allProducts[product] = true;
      });
      setCollapsedGroups(allProducts);
    } else {
      setCollapsedGroups({});
    }
  }, [groupByProduct]);

  // Sort rows
  const sortedRows = React.useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const aVal = parseSortValue(a[sortCol]);
      const bVal = parseSortValue(b[sortCol]);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'string') return 1;
      if (typeof bVal === 'string') return -1;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [rows, sortCol, sortDir]);

  // Group rows by product
  const groupedData = React.useMemo(() => {
    if (!groupByProduct || !hasProductColumn) return null;
    const groups = {};
    sortedRows.forEach((row) => {
      const product = row['Product'] || 'Other';
      if (!groups[product]) groups[product] = [];
      groups[product].push(row);
    });
    return groups;
  }, [sortedRows, groupByProduct, hasProductColumn]);

  // Build subtotal row for a group of rows
  const buildSubtotalRow = (groupRows) => {
    const subtotal = {};
    const colSums = {};
    // First pass: sum all numeric columns
    columns.forEach((col) => {
      if (col === 'Product') { subtotal[col] = ''; return; }
      if (col === 'SKU' || col === 'Variant') { subtotal[col] = ''; return; }
      const isPctCol = col.toLowerCase().includes('change') || col.toLowerCase().includes('share');
      if (isPctCol) { subtotal[col] = ''; return; } // filled in second pass
      let sum = 0;
      let hasNumbers = false;
      let isCurrencyCol = false;
      groupRows.forEach((row) => {
        const val = parseSortValue(row[col]);
        if (typeof val === 'number' && val !== -Infinity) {
          sum += val;
          hasNumbers = true;
          if (String(row[col]).includes('$')) isCurrencyCol = true;
        }
      });
      colSums[col] = sum;
      if (hasNumbers) {
        subtotal[col] = isCurrencyCol ? formatCurrency(sum) : sum.toLocaleString();
      } else {
        subtotal[col] = '';
      }
    });
    // Second pass: compute Change % from current/prior sums
    columns.forEach((col) => {
      if (!col.toLowerCase().includes('change')) return;
      // Find the current and prior columns by name pattern
      const currentCol = columns.find((c) => c.match(/^current/i) && !c.toLowerCase().includes('change'));
      const priorCol = columns.find((c) => c.match(/^prior/i) && !c.toLowerCase().includes('change'));
      if (currentCol && priorCol && colSums[currentCol] !== undefined && colSums[priorCol] !== undefined) {
        subtotal[col] = formatPercent(colSums[currentCol], colSums[priorCol]);
      }
    });
    return subtotal;
  };

  const renderSubtotalRow = (subtotal, key) => (
    <tr key={key} className="bg-blue-100/50 border-b-2 border-blue-200 font-semibold">
      {columns.map((col) => {
        const val = subtotal[col] ?? '';
        let colorClass = 'text-blue-900';
        if (col.toLowerCase().includes('change') && typeof val === 'string') {
          if (val.startsWith('+') && val !== '+0.0%') colorClass = 'text-emerald-600';
          else if (val.startsWith('-')) colorClass = 'text-red-600';
        }
        return (
          <td key={`sub-${key}-${col}`} className={`px-4 py-2 text-sm ${colorClass}`}>
            {val}
          </td>
        );
      })}
    </tr>
  );

  const sortArrow = (col) => {
    if (sortCol !== col) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderRow = (row, idx, bgOffset = 0) => (
    <tr
      key={idx}
      className={`border-b border-slate-100 ${(idx + bgOffset) % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
    >
      {columns.map((col) => (
        <td key={`${idx}-${col}`} className={`px-4 py-3 ${getCellClass(col, row[col])}`}>
          {row[col] ?? '—'}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-x-auto card">
      {(enableGrouping || hasProductColumn) && hasProductColumn && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setGroupByProduct(!groupByProduct)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              groupByProduct
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
            }`}
          >
            {groupByProduct ? '✓ Grouped by Product' : 'Group by Product'}
          </button>
        </div>
      )}
      <table className={`min-w-full text-sm ${className}`} style={{ tableLayout: 'auto' }}>
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                className={`px-4 py-3 ${getAlignment(col)} font-bold text-slate-900 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors relative`}
                style={colWidths[col] ? { width: colWidths[col], minWidth: colWidths[col] } : col === 'Product' ? { minWidth: 280 } : undefined}
              >
                {col}{sortArrow(col)}
                <span
                  onMouseDown={(e) => handleResizeStart(col, e)}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/50"
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedData ? (
            Object.entries(groupedData).map(([product, groupRows]) => {
              const isCollapsed = !!collapsedGroups[product];
              const subtotal = groupRows.length > 1 ? buildSubtotalRow(groupRows) : groupRows[0];
              const toggleCollapse = () => setCollapsedGroups((prev) => ({ ...prev, [product]: !prev[product] }));
              return (
                <React.Fragment key={product}>
                  <tr
                    className="bg-blue-50 border-b border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={toggleCollapse}
                  >
                    {columns.map((col) => {
                      if (col === 'Product') {
                        return (
                          <td key={`gh-${product}-${col}`} className="px-4 py-2 font-semibold text-blue-900 text-sm">
                            <span className={`inline-block transition-transform mr-2 text-blue-400 ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                            {product}
                            <span className="text-blue-500 font-normal ml-2">({groupRows.length})</span>
                          </td>
                        );
                      }
                      if (col === 'SKU' || col === 'Variant') {
                        return <td key={`gh-${product}-${col}`} className="px-4 py-2 text-sm text-blue-900">{''}</td>;
                      }
                      if (subtotal) {
                        const val = subtotal[col] ?? '';
                        let colorClass = `text-blue-900 font-semibold ${getAlignment(col)}`;
                        if (col.toLowerCase().includes('change') && typeof val === 'string') {
                          if (val.startsWith('+') && val !== '+0.0%') colorClass = `text-emerald-600 font-semibold ${getAlignment(col)}`;
                          else if (val.startsWith('-')) colorClass = `text-red-600 font-semibold ${getAlignment(col)}`;
                        }
                        return (
                          <td key={`gh-${product}-${col}`} className={`px-4 py-2 text-sm ${colorClass}`}>
                            {val}
                          </td>
                        );
                      }
                      return <td key={`gh-${product}-${col}`} className={`px-4 py-2 text-sm text-blue-900 ${getAlignment(col)}`}>{''}</td>;
                    })}
                  </tr>
                  {!isCollapsed && groupRows.map((row, idx) => renderRow(row, idx))}
                </React.Fragment>
              );
            })
          ) : (
            sortedRows.map((row, idx) => renderRow(row, idx))
          )}
        </tbody>
        {footerRows.length > 0 && (
          <tfoot>
            {footerRows.map((frow, fIdx) => (
              <tr key={fIdx} className={`border-t-2 border-slate-300 ${frow._style === 'highlight' ? 'bg-blue-50 font-bold' : 'bg-slate-100 font-semibold'}`}>
                {columns.map((col) => (
                  <td key={`f-${fIdx}-${col}`} className={`px-4 py-3 text-sm ${getCellClass(col, frow[col] ?? '')}`}>
                    {frow[col] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
};

// Main dashboard component
export default function VendorDashboard() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug;
  const reportIdFromUrl = searchParams.get('report');
  const dashboardRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [monthlySkuData, setMonthlySkuData] = useState({});
  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [categoryMonthly, setCategoryMonthly] = useState({});
  const [months, setMonths] = useState([]);
  const [activeTab, setActiveTab] = useState('Campaign Period');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [filteredMonths, setFilteredMonths] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [dailyData, setDailyData] = useState({});
  const [chartView, setChartView] = useState('month'); // 'month', 'week', or 'day'
  const [skuView, setSkuView] = useState('sales'); // 'sales' or 'units'
  const [companyLogo, setCompanyLogo] = useState(null);
  const [periodUniqueReturning, setPeriodUniqueReturning] = useState(null);
  const [periodPrevUniqueReturning, setPeriodPrevUniqueReturning] = useState(null);

  // Auth check and data loading
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        setLoading(true);

        // Check authentication
        const authStr = sessionStorage.getItem('auth');
        if (!authStr) {
          router.push('/');
          return;
        }

        const auth = JSON.parse(authStr);
        if (auth.role !== 'vendor' || auth.slug !== slug) {
          router.push('/');
          return;
        }

        const vendorId = auth.vendorId;

        // Load vendor config
        const vendorData = await getVendorBySlug(slug);
        if (!vendorData) {
          setError('Vendor not found');
          return;
        }
        setVendor(vendorData);

        // Load company logo
        const logo = await getAppSetting('company_logo');
        if (logo) setCompanyLogo(logo);

        // Load reports for this vendor
        const reportsData = await getReportsByVendorId(vendorId);
        setReports(reportsData);

        // Determine which report to display
        let selectedReport;
        if (reportIdFromUrl) {
          selectedReport = reportsData.find((r) => r.id === reportIdFromUrl);
        }
        if (!selectedReport) {
          selectedReport = reportsData.find((r) => r.is_default) || reportsData[0];
        }

        if (!selectedReport) {
          setMonthlySkuData({});
          setMonthlyTotals({});
          setCategoryMonthly({});
          setMonths([]);
          setLoading(false);
          return;
        }
        setCurrentReport(selectedReport);

        const reportId = selectedReport.id;

        // Load product, category, daily data, customer data, and title mappings by report
        const productRows = await getProductData(reportId);
        const categoryRows = await getCategoryData(reportId);
        const dailyRows = await getDailyProductData(reportId);
        const customerRows = await getCustomerData(reportId);
        const titleMappings = await getSkuTitleMap(reportId);

        // Build SKU -> title lookup from mappings
        const titleMap = {};
        (titleMappings || []).forEach((m) => {
          titleMap[m.sku] = { productTitle: m.product_title, variantTitle: m.variant_title || '' };
        });

        if (!productRows || productRows.length === 0) {
          setMonthlySkuData({});
          setMonthlyTotals({});
          setCategoryMonthly({});
          setMonths([]);
          setLoading(false);
          return;
        }

        // Restructure product data
        const skuMap = {}; // SKUs auto-detected from CSV data
        const restructuredSkuData = {};
        const restructuredTotals = {};
        const monthsList = [];

        productRows.forEach((row) => {
          const month = row.month;
          const sku = row.sku;

          if (!monthsList.includes(month)) {
            monthsList.push(month);
          }

          if (!restructuredSkuData[month]) {
            restructuredSkuData[month] = {};
          }

          if (!restructuredTotals[month]) {
            restructuredTotals[month] = {
              totalSales: 0,
              netItems: 0,
              newCustomers: 0,
              returningCustomers: 0,
              prevTotalSales: 0,
              prevNetItems: 0,
              prevNewCustomers: 0,
              prevReturningCustomers: 0,
            };
          }

          const totalSales = parseFloat(row.total_sales) || 0;
          const netItems = parseInt(row.net_items) || 0;
          const newCustomers = parseInt(row.new_customers) || 0;
          const returningCustomers = parseInt(row.returning_customers) || 0;
          const prevTotalSales = parseFloat(row.prev_total_sales) || 0;
          const prevNetItems = parseInt(row.prev_net_items) || 0;
          const prevNewCustomers = parseInt(row.prev_new_customers) || 0;
          const prevReturningCustomers = parseInt(row.prev_returning_customers) || 0;

          // Use title map override if available, otherwise fall back to DB values
          const mapped = titleMap[sku];
          const productTitle = mapped ? mapped.productTitle : (row.product_title || '');
          const variantTitle = mapped ? mapped.variantTitle : (row.variant_title || '');
          let skuLabel = row.sku_label || sku;
          if (productTitle) {
            skuLabel = variantTitle && variantTitle.toLowerCase() !== 'default title'
              ? `${productTitle} - ${variantTitle}`
              : productTitle;
          }

          restructuredSkuData[month][sku] = {
            totalSales,
            netItems,
            newCustomers,
            returningCustomers,
            prevTotalSales,
            prevNetItems,
            prevNewCustomers,
            prevReturningCustomers,
            skuLabel,
            productTitle,
            variantTitle,
          };

          restructuredTotals[month].totalSales += totalSales;
          restructuredTotals[month].netItems += netItems;
          restructuredTotals[month].newCustomers += newCustomers;
          restructuredTotals[month].returningCustomers += returningCustomers;
          restructuredTotals[month].prevTotalSales += prevTotalSales;
          restructuredTotals[month].prevNetItems += prevNetItems;
          restructuredTotals[month].prevNewCustomers += prevNewCustomers;
          restructuredTotals[month].prevReturningCustomers += prevReturningCustomers;
        });

        // Add all SKUs to all months (even if 0 sales)
        monthsList.forEach((month) => {
          Object.keys(skuMap).forEach((sku) => {
            if (!restructuredSkuData[month][sku]) {
              restructuredSkuData[month][sku] = {
                totalSales: 0,
                netItems: 0,
                newCustomers: 0,
                returningCustomers: 0,
                prevTotalSales: 0,
                prevNetItems: 0,
                skuLabel: skuMap[sku],
              };
            }
          });
        });

        // Sort months chronologically
        monthsList.sort();

        // Restructure category data
        const restructuredCategoryData = {};
        categoryRows.forEach((row) => {
          const month = row.month;
          if (!restructuredCategoryData[month]) {
            restructuredCategoryData[month] = {
              totalSales: 0,
              prevTotalSales: 0,
            };
          }
          restructuredCategoryData[month].totalSales = parseFloat(row.total_sales) || 0;
          restructuredCategoryData[month].prevTotalSales = parseFloat(row.prev_total_sales) || 0;
        });

        // Restructure daily data
        const restructuredDailyData = {};
        dailyRows.forEach((row) => {
          const day = row.day; // YYYY-MM-DD string
          restructuredDailyData[day] = {
            totalSales: parseFloat(row.total_sales) || 0,
            netItems: parseInt(row.net_items) || 0,
            newCustomers: parseInt(row.new_customers) || 0,
            returningCustomers: parseInt(row.returning_customers) || 0,
            prevTotalSales: parseFloat(row.prev_total_sales) || 0,
            prevNetItems: parseInt(row.prev_net_items) || 0,
            prevNewCustomers: parseInt(row.prev_new_customers) || 0,
            prevReturningCustomers: parseInt(row.prev_returning_customers) || 0,
          };
        });

        // Override customer counts with deduplicated uploaded customer data if available
        let periodUniqueReturning = null;
        let periodPrevUniqueReturning = null;
        if (customerRows && customerRows.length > 0) {
          customerRows.forEach((row) => {
            const month = row.month;
            if (month === '_period') {
              // Extract period-level unique returning customer counts
              periodUniqueReturning = parseInt(row.returning_customers) || 0;
              periodPrevUniqueReturning = parseInt(row.prev_returning_customers) || 0;
              return;
            }
            if (restructuredTotals[month]) {
              restructuredTotals[month].newCustomers = parseInt(row.new_customers) || 0;
              restructuredTotals[month].returningCustomers = parseInt(row.returning_customers) || 0;
              restructuredTotals[month].prevNewCustomers = parseInt(row.prev_new_customers) || 0;
              restructuredTotals[month].prevReturningCustomers = parseInt(row.prev_returning_customers) || 0;
            }
          });
        }
        setPeriodUniqueReturning(periodUniqueReturning);
        setPeriodPrevUniqueReturning(periodPrevUniqueReturning);

        setMonthlySkuData(restructuredSkuData);
        setMonthlyTotals(restructuredTotals);
        setCategoryMonthly(restructuredCategoryData);
        setDailyData(restructuredDailyData);
        setMonths(monthsList);
        setFilteredMonths(monthsList);
        setDateRange({ start: monthsList[0], end: monthsList[monthsList.length - 1] });
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError(
          err.message || 'Failed to load dashboard data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, [router, slug, reportIdFromUrl]);

  // Apply date range filter
  const handleApplyDateRange = () => {
    if (dateRange.start && dateRange.end) {
      const startIdx = months.indexOf(dateRange.start);
      const endIdx = months.indexOf(dateRange.end);
      if (startIdx !== -1 && endIdx !== -1) {
        const newFiltered = months.slice(
          Math.min(startIdx, endIdx),
          Math.max(startIdx, endIdx) + 1
        );
        setFilteredMonths(newFiltered);
      }
    }
  };

  const handleResetDateRange = () => {
    setFilteredMonths(months);
    setDateRange({ start: months[0], end: months[months.length - 1] });
  };

  // Export to PDF
  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const html2canvasModule = await import('html2canvas');
      const html2canvasFunc = html2canvasModule.default;
      const jsPDFModule = await import('jspdf');
      const jsPDFClass = jsPDFModule.jsPDF;

      const canvas = await html2canvasFunc(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      const fileName = `${vendor.name}-Campaign-Report-${
        new Date().toISOString().split('T')[0]
      }.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Render states
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!vendor || months.length === 0) {
    return <NoDataState />;
  }

  // Calculate analytics
  const yoyData = calculateYoY(monthlyTotals, monthlySkuData, filteredMonths);
  const momData = calculateMoM(monthlyTotals, monthlySkuData, filteredMonths);
  const campaignData = calculateCampaignPeriod(
    monthlyTotals,
    monthlySkuData,
    filteredMonths,
    categoryMonthly
  );

  const yoyInsights = generateYoYInsights(yoyData);
  const momInsights = generateMoMInsights(momData);
  const campaignInsights = generateCampaignInsights(campaignData);
  const categoryShareData = {
    months: filteredMonths,
    categoryMonthly: Object.fromEntries(
      filteredMonths.map((m) => [m, categoryMonthly[m]])
    ),
    monthlyTotals: Object.fromEntries(
      filteredMonths.map((m) => [m, monthlyTotals[m]])
    ),
  };
  const categoryInsights = generateCategoryInsights(categoryShareData);
  const executiveSummary = generateExecutiveSummary(yoyData, campaignData);

  // Resolve insights: use custom override if set, hide if flagged, else auto-generated
  const resolveInsight = (tabKey, autoGenerated) => {
    const custom = currentReport?.custom_insights?.[tabKey];
    if (!custom) return autoGenerated;
    if (custom.hidden) return null;
    if (custom.text && custom.text.trim().length > 0) return custom.text;
    return autoGenerated;
  };

  const resolvedExecutive = resolveInsight('executive', executiveSummary);
  const resolvedYoY = resolveInsight('yoy', yoyInsights);
  const resolvedMoM = resolveInsight('mom', momInsights);
  const resolvedCampaign = resolveInsight('campaign', campaignInsights);
  const resolvedCategory = resolveInsight('category', categoryInsights);

  // Calculate campaign totals
  const campaignTotalSales = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.totalSales || 0),
    0
  );
  const campaignPrevSales = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.prevTotalSales || 0),
    0
  );
  const campaignTotalUnits = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.netItems || 0),
    0
  );
  const campaignPrevUnits = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.prevNetItems || 0),
    0
  );
  const campaignNewCustomers = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.newCustomers || 0),
    0
  );
  const campaignPrevNewCustomers = filteredMonths.reduce(
    (sum, m) => sum + (monthlyTotals[m]?.prevNewCustomers || 0),
    0
  );

  // Calculate returning customers — use period-level dedup when all months selected, otherwise sum monthly
  const allMonthsSelected = filteredMonths.length === months.length;
  const campaignReturningCustomers = periodUniqueReturning !== null
    ? (allMonthsSelected
        ? periodUniqueReturning
        : filteredMonths.reduce((sum, m) => sum + (monthlyTotals[m]?.returningCustomers || 0), 0))
    : null;
  const campaignPrevReturningCustomers = periodPrevUniqueReturning !== null
    ? (allMonthsSelected
        ? periodPrevUniqueReturning
        : filteredMonths.reduce((sum, m) => sum + (monthlyTotals[m]?.prevReturningCustomers || 0), 0))
    : null;

  // Calculate category share (product sales / category sales)
  const totalCategorySales = filteredMonths.reduce(
    (sum, m) => sum + (categoryMonthly[m]?.totalSales || 0),
    0
  );
  const totalPrevCategorySales = filteredMonths.reduce(
    (sum, m) => sum + (categoryMonthly[m]?.prevTotalSales || 0),
    0
  );
  const categoryShare =
    filteredMonths.length > 0 && totalCategorySales > 0
      ? ((campaignTotalSales / totalCategorySales) * 100).toFixed(1)
      : 0;
  const prevCategoryShare =
    filteredMonths.length > 0 && totalPrevCategorySales > 0
      ? ((campaignPrevSales / totalPrevCategorySales) * 100).toFixed(1)
      : 0;

  const handleReportChange = (reportId) => {
    setShowReportMenu(false);
    router.push(`/dashboard/${slug}?report=${reportId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Navbar */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {vendor.logo_url ? (
              <img
                src={vendor.logo_url}
                alt={vendor.name}
                className="h-10 object-contain"
              />
            ) : (
              <span className="font-semibold text-slate-900 text-lg">{vendor.name}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Reports dropdown pill */}
            {reports.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowReportMenu(!showReportMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-blue-900">
                    {currentReport?.name || 'Reports'}
                  </span>
                  <svg className={`w-4 h-4 text-blue-700 transition-transform ${showReportMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showReportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => handleReportChange(report.id)}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          report.id === currentReport?.id
                            ? 'bg-blue-50 font-semibold text-blue-900'
                            : 'text-slate-700'
                        }`}
                      >
                        {report.name}
                        {report.is_default && (
                          <span className="ml-2 text-xs text-slate-400">(Default)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {companyLogo && (
              <div className="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200">
                <span className="text-xs text-slate-400 font-medium">Prepared by</span>
                <img src={companyLogo} alt="Company logo" className="h-7 object-contain" />
              </div>
            )}
          </div>
        </div>
      </nav>

      <div ref={dashboardRef} className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                  Payless Medical Campaign Report
                </h1>
                {currentReport?.product_name && (
                  <p className="text-lg text-slate-600">{currentReport.product_name}</p>
                )}
              </div>
              <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold text-sm">
                {filteredMonths[0]} to {filteredMonths[filteredMonths.length - 1]}
              </div>
            </div>

            {vendor.show_budget && vendor.monthly_budget && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-slate-600">
                  <span className="font-semibold">Monthly Investment:</span>{' '}
                  {formatCurrency(vendor.monthly_budget)}
                </p>
              </div>
            )}
          </div>

          {/* Executive Summary */}
          <InsightBox insights={resolvedExecutive} />

          {/* KPI Cards */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${periodUniqueReturning !== null && !vendor?.hide_category_tab ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-6`}>
            <KPICard
              title="Total Sales"
              value={campaignTotalSales}
              previousValue={campaignPrevSales}
              isCurrency
            />
            <KPICard
              title="Total Units Sold"
              value={campaignTotalUnits}
              previousValue={campaignPrevUnits}
            />
            <KPICard
              title="New Customers Acquired"
              value={campaignNewCustomers}
              previousValue={campaignPrevNewCustomers}
            />
            {campaignReturningCustomers !== null && (
              <KPICard
                title="Unique Returning Customers"
                value={campaignReturningCustomers}
                previousValue={campaignPrevReturningCustomers}
              />
            )}
            {!vendor?.hide_category_tab && (
              <KPICard
                title="Category Share"
                value={parseFloat(categoryShare)}
                previousValue={parseFloat(prevCategoryShare)}
                isPercentage
              />
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <TabNavigation
              tabs={[
                'Campaign Period',
                'Year-over-Year',
                'Month-over-Month',
                ...(vendor?.hide_category_tab ? [] : ['Category Share']),
              ]}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            <div className="p-6">
              {/* Date Range Filter */}
              <div className="mb-6 flex gap-4 items-end bg-slate-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Start Month
                  </label>
                  <select
                    value={dateRange.start || ''}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, start: e.target.value })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    End Month
                  </label>
                  <select
                    value={dateRange.end || ''}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, end: e.target.value })
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleApplyDateRange}
                  className="btn-primary px-4 py-2"
                >
                  Apply
                </button>
                <button
                  onClick={handleResetDateRange}
                  className="btn-secondary px-4 py-2"
                >
                  Reset
                </button>
              </div>

              {/* Year-over-Year Tab */}
              {activeTab === 'Year-over-Year' && (
                <div>
                  <InsightBox insights={resolvedYoY} />

                  {/* YoY Sales Line Chart with Month/Week/Day Toggle */}
                  <div className="card mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">
                        Sales Comparison {chartView === 'month' ? 'by Month' : chartView === 'week' ? 'by Week' : 'by Day'}
                      </h3>
                      <div className="flex bg-slate-100 rounded-lg p-1">
                        {['month', 'week', 'day'].map((view) => (
                          <button
                            key={view}
                            onClick={() => setChartView(view)}
                            disabled={view !== 'month' && Object.keys(dailyData).length === 0}
                            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
                              chartView === view
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            } ${view !== 'month' && Object.keys(dailyData).length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {view}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(() => {
                      const hasDailyData = Object.keys(dailyData).length > 0;

                      // Shared chart style options (Shopify-like)
                      const shopifyChartOptions = {
                        responsive: true,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              usePointStyle: true,
                              pointStyle: 'circle',
                              padding: 20,
                              font: { size: 13 },
                            },
                          },
                          tooltip: {
                            backgroundColor: '#1a1a2e',
                            titleFont: { size: 13 },
                            bodyFont: { size: 13 },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                              label: (ctx) => `  ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 12 } },
                          },
                          y: {
                            beginAtZero: true,
                            suggestedMax: 1000,
                            grid: { color: '#f1f5f9' },
                            border: { display: false },
                            ticks: {
                              color: '#94a3b8',
                              font: { size: 12 },
                              callback: (value) => formatCurrency(value),
                            },
                          },
                        },
                        elements: {
                          line: { tension: 0.4 },
                        },
                      };

                      const currentDataset = (data) => ({
                        label: 'Current Year',
                        data,
                        borderColor: BRAND_COLORS.current,
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: BRAND_COLORS.current,
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2,
                        fill: false,
                        tension: 0.4,
                      });

                      const priorDataset = (data) => ({
                        label: 'Prior Year',
                        data,
                        borderColor: BRAND_COLORS.previous,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: BRAND_COLORS.previous,
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2,
                        fill: false,
                        tension: 0.4,
                      });

                      if (chartView === 'month') {
                        return (
                          <Line
                            data={{
                              labels: filteredMonths,
                              datasets: [
                                currentDataset(filteredMonths.map((m) => monthlyTotals[m]?.totalSales || 0)),
                                priorDataset(filteredMonths.map((m) => monthlyTotals[m]?.prevTotalSales || 0)),
                              ],
                            }}
                            options={shopifyChartOptions}
                          />
                        );
                      }

                      // Filter daily data to days within the selected month range
                      const filteredDays = Object.keys(dailyData)
                        .filter((day) => filteredMonths.includes(day.substring(0, 7)))
                        .sort();

                      if (chartView === 'week') {
                        // Aggregate daily data into ISO weeks
                        const weekMap = {};
                        filteredDays.forEach((d) => {
                          const date = new Date(d + 'T00:00:00');
                          // Get ISO week start (Monday)
                          const dayOfWeek = date.getDay();
                          const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                          const weekStart = new Date(date);
                          weekStart.setDate(diff);
                          const weekKey = weekStart.toISOString().split('T')[0];

                          if (!weekMap[weekKey]) {
                            weekMap[weekKey] = { totalSales: 0, prevTotalSales: 0 };
                          }
                          weekMap[weekKey].totalSales += dailyData[d]?.totalSales || 0;
                          weekMap[weekKey].prevTotalSales += dailyData[d]?.prevTotalSales || 0;
                        });

                        const weekKeys = Object.keys(weekMap).sort();
                        const weekLabels = weekKeys.map((wk) => {
                          const date = new Date(wk + 'T00:00:00');
                          return `Wk ${date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
                        });

                        const weekOptions = {
                          ...shopifyChartOptions,
                          plugins: {
                            ...shopifyChartOptions.plugins,
                            tooltip: {
                              ...shopifyChartOptions.plugins.tooltip,
                              callbacks: {
                                title: (items) => {
                                  const wk = weekKeys[items[0].dataIndex];
                                  const end = new Date(wk + 'T00:00:00');
                                  end.setDate(end.getDate() + 6);
                                  return `${wk} to ${end.toISOString().split('T')[0]}`;
                                },
                                label: (ctx) => `  ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                              },
                            },
                          },
                          scales: {
                            ...shopifyChartOptions.scales,
                            x: { ...shopifyChartOptions.scales.x, ticks: { ...shopifyChartOptions.scales.x.ticks, maxTicksLimit: 20, maxRotation: 45 } },
                          },
                        };

                        return (
                          <Line
                            data={{
                              labels: weekLabels,
                              datasets: [
                                currentDataset(weekKeys.map((wk) => weekMap[wk].totalSales)),
                                priorDataset(weekKeys.map((wk) => weekMap[wk].prevTotalSales)),
                              ],
                            }}
                            options={weekOptions}
                          />
                        );
                      }

                      // Day view
                      const dayLabels = filteredDays.map((d) => {
                        const date = new Date(d + 'T00:00:00');
                        return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
                      });

                      const dayOptions = {
                        ...shopifyChartOptions,
                        plugins: {
                          ...shopifyChartOptions.plugins,
                          tooltip: {
                            ...shopifyChartOptions.plugins.tooltip,
                            callbacks: {
                              title: (items) => filteredDays[items[0].dataIndex] || '',
                              label: (ctx) => `  ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                            },
                          },
                        },
                        scales: {
                          ...shopifyChartOptions.scales,
                          x: { ...shopifyChartOptions.scales.x, ticks: { ...shopifyChartOptions.scales.x.ticks, maxTicksLimit: 15, maxRotation: 45 } },
                        },
                      };

                      return (
                        <Line
                          data={{
                            labels: dayLabels,
                            datasets: [
                              currentDataset(filteredDays.map((d) => dailyData[d]?.totalSales || 0)),
                              priorDataset(filteredDays.map((d) => dailyData[d]?.prevTotalSales || 0)),
                            ],
                          }}
                          options={dayOptions}
                        />
                      );
                    })()}
                    {(chartView === 'day' || chartView === 'week') && Object.keys(dailyData).length === 0 && (
                      <p className="text-sm text-slate-500 mt-2 text-center">
                        Daily data not available. Re-upload the CSV to enable weekly and daily views.
                      </p>
                    )}
                  </div>

                  {/* SKU Data by Month - Sales/Units Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">
                      {skuView === 'sales' ? 'Sales by SKU' : 'Units Sold by SKU'}
                    </h3>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      {['sales', 'units'].map((view) => (
                        <button
                          key={view}
                          onClick={() => setSkuView(view)}
                          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
                            skuView === view
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {view === 'sales' ? 'Sales' : 'Units'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {[...filteredMonths].reverse().map((month, rIdx) => {
                    const skuKeys = Object.keys(monthlySkuData[month] || {});
                    const totalCurrent = skuView === 'sales'
                      ? skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.totalSales || 0), 0)
                      : skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.netItems || 0), 0);
                    const totalPrior = skuView === 'sales'
                      ? skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.prevTotalSales || 0), 0)
                      : skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.prevNetItems || 0), 0);
                    const daysInMonth = getDaysInMonth(month);
                    return (
                    <details key={`${skuView}-${month}`} className="mb-6" open={rIdx === 0}>
                      <summary className="text-md font-semibold text-slate-700 mb-2 cursor-pointer hover:text-slate-900 select-none list-none">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 inline-block transition-transform">▶</span>
                          <span>{formatMonthTitle(month)} Results</span>
                          <span className="ml-auto flex gap-4 text-xs font-normal text-slate-500 collapsed-stats">
                            <span>Total: <span className="font-semibold text-slate-700">{skuView === 'sales' ? formatCurrency(totalCurrent) : `${totalCurrent.toLocaleString()} units`}</span></span>
                            <span>Avg Daily: <span className="font-semibold text-slate-700">{skuView === 'sales' ? formatCurrency(totalCurrent / daysInMonth) : `${(totalCurrent / daysInMonth).toFixed(1)} units`}</span></span>
                            <span className={`font-semibold ${totalCurrent >= totalPrior ? 'text-emerald-600' : 'text-red-600'}`}>{formatPercent(totalCurrent, totalPrior)}</span>
                          </span>
                        </div>
                      </summary>
                      <div className="mt-2">
                      {skuView === 'sales' ? (
                        <DataTable
                          columns={['SKU', 'Product', 'Variant', 'Current Sales', 'Prior Year Sales', 'Change %']}
                          rows={skuKeys.map((sku) => {
                            const data = monthlySkuData[month][sku];
                            return {
                              'SKU': sku,
                              'Product': data.productTitle || data.skuLabel,
                              'Variant': data.variantTitle && data.variantTitle.toLowerCase() !== 'default title' ? data.variantTitle : '—',
                              'Current Sales': formatCurrency(data.totalSales),
                              'Prior Year Sales': formatCurrency(data.prevTotalSales),
                              'Change %': formatPercent(data.totalSales, data.prevTotalSales),
                            };
                          })}
                          footerRows={[
                            { 'SKU': '', 'Product': 'Total', 'Variant': '', 'Current Sales': formatCurrency(totalCurrent), 'Prior Year Sales': formatCurrency(totalPrior), 'Change %': formatPercent(totalCurrent, totalPrior), _style: 'highlight' },
                            { 'SKU': '', 'Product': 'Avg Daily Sales', 'Variant': '', 'Current Sales': formatCurrency(totalCurrent / daysInMonth), 'Prior Year Sales': formatCurrency(totalPrior / daysInMonth), 'Change %': '', _style: 'default' },
                          ]}
                        />
                      ) : (
                        <DataTable
                          columns={['SKU', 'Product', 'Variant', 'Current Units', 'Prior Year Units', 'Change %']}
                          rows={skuKeys.map((sku) => {
                            const data = monthlySkuData[month][sku];
                            return {
                              'SKU': sku,
                              'Product': data.productTitle || data.skuLabel,
                              'Variant': data.variantTitle && data.variantTitle.toLowerCase() !== 'default title' ? data.variantTitle : '—',
                              'Current Units': data.netItems.toLocaleString(),
                              'Prior Year Units': (data.prevNetItems || 0).toLocaleString(),
                              'Change %': formatPercent(data.netItems, data.prevNetItems || 0),
                            };
                          })}
                          footerRows={[
                            { 'SKU': '', 'Product': 'Total', 'Variant': '', 'Current Units': totalCurrent.toLocaleString(), 'Prior Year Units': totalPrior.toLocaleString(), 'Change %': formatPercent(totalCurrent, totalPrior), _style: 'highlight' },
                            { 'SKU': '', 'Product': 'Avg Daily Units', 'Variant': '', 'Current Units': (totalCurrent / daysInMonth).toFixed(1), 'Prior Year Units': (totalPrior / daysInMonth).toFixed(1), 'Change %': '', _style: 'default' },
                          ]}
                        />
                      )}
                      </div>
                    </details>
                    );
                  })}
                </div>
              )}

              {/* Month-over-Month Tab */}
              {activeTab === 'Month-over-Month' && (
                <div>
                  <InsightBox insights={resolvedMoM} />

                  {filteredMonths.length > 1 ? (
                    <>
                      {/* Sales/Units Toggle */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">
                          {skuView === 'sales' ? 'Sales Comparison' : 'Units Sold Comparison'}
                        </h3>
                        <div className="flex bg-slate-100 rounded-lg p-1">
                          {['sales', 'units'].map((view) => (
                            <button
                              key={view}
                              onClick={() => setSkuView(view)}
                              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
                                skuView === view
                                  ? 'bg-white text-blue-600 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {view === 'sales' ? 'Sales' : 'Units'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {[...filteredMonths].reverse().map((month, rIdx) => {
                        const origIdx = filteredMonths.indexOf(month);
                        if (origIdx === 0) return null;
                        const prevMonth = filteredMonths[origIdx - 1];
                        const skuKeys = Object.keys(monthlySkuData[month] || {});
                        const totalCurrentSales = skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.totalSales || 0), 0);
                        const totalPriorSales = skuKeys.reduce((sum, sku) => sum + (monthlySkuData[prevMonth]?.[sku]?.totalSales || 0), 0);
                        const totalCurrentUnits = skuKeys.reduce((sum, sku) => sum + (monthlySkuData[month][sku]?.netItems || 0), 0);
                        const totalPriorUnits = skuKeys.reduce((sum, sku) => sum + (monthlySkuData[prevMonth]?.[sku]?.netItems || 0), 0);
                        const daysInCurrent = getDaysInMonth(month);
                        const daysInPrior = getDaysInMonth(prevMonth);

                        const totalCurrentVal = skuView === 'sales' ? totalCurrentSales : totalCurrentUnits;
                        const totalPriorVal = skuView === 'sales' ? totalPriorSales : totalPriorUnits;

                        return (
                          <details key={`${skuView}-${month}`} className="mb-8" open={rIdx === 0}>
                            <summary className="text-lg font-bold text-slate-900 mb-3 cursor-pointer hover:text-slate-700 select-none list-none">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 inline-block transition-transform">▶</span>
                                <span>{formatMonthTitle(month)} vs {formatMonthTitle(prevMonth)} (Previous Period)</span>
                                <span className="ml-auto flex gap-4 text-xs font-normal text-slate-500 collapsed-stats">
                                  <span>Total: <span className="font-semibold text-slate-700">{skuView === 'sales' ? formatCurrency(totalCurrentVal) : `${totalCurrentVal.toLocaleString()} units`}</span></span>
                                  <span>Avg Daily: <span className="font-semibold text-slate-700">{skuView === 'sales' ? formatCurrency(totalCurrentVal / daysInCurrent) : `${(totalCurrentVal / daysInCurrent).toFixed(1)} units`}</span></span>
                                  <span className={`font-semibold ${totalCurrentVal >= totalPriorVal ? 'text-emerald-600' : 'text-red-600'}`}>{formatPercent(totalCurrentVal, totalPriorVal)}</span>
                                </span>
                              </div>
                            </summary>
                            <div className="mt-3">
                            {skuView === 'sales' ? (
                              <DataTable
                                columns={['SKU', 'Product', 'Variant', 'Current Month', 'Prior Month', 'Change %']}
                                rows={skuKeys.map((sku) => {
                                  const currentData = monthlySkuData[month][sku];
                                  const priorData = monthlySkuData[prevMonth]?.[sku];
                                  return {
                                    'SKU': sku,
                                    'Product': currentData.productTitle || currentData.skuLabel,
                                    'Variant': currentData.variantTitle && currentData.variantTitle.toLowerCase() !== 'default title' ? currentData.variantTitle : '—',
                                    'Current Month': formatCurrency(currentData.totalSales),
                                    'Prior Month': formatCurrency(priorData?.totalSales || 0),
                                    'Change %': formatPercent(currentData.totalSales, priorData?.totalSales || 0),
                                  };
                                })}
                                footerRows={[
                                  { 'SKU': '', 'Product': 'Total', 'Variant': '', 'Current Month': formatCurrency(totalCurrentSales), 'Prior Month': formatCurrency(totalPriorSales), 'Change %': formatPercent(totalCurrentSales, totalPriorSales), _style: 'highlight' },
                                  { 'SKU': '', 'Product': 'Avg Daily Sales', 'Variant': '', 'Current Month': formatCurrency(totalCurrentSales / daysInCurrent), 'Prior Month': formatCurrency(totalPriorSales / daysInPrior), 'Change %': formatPercent(totalCurrentSales / daysInCurrent, totalPriorSales / daysInPrior), _style: 'default' },
                                ]}
                              />
                            ) : (
                              <DataTable
                                columns={['SKU', 'Product', 'Variant', 'Current Month', 'Prior Month', 'Change %']}
                                rows={skuKeys.map((sku) => {
                                  const currentData = monthlySkuData[month][sku];
                                  const priorData = monthlySkuData[prevMonth]?.[sku];
                                  return {
                                    'SKU': sku,
                                    'Product': currentData.productTitle || currentData.skuLabel,
                                    'Variant': currentData.variantTitle && currentData.variantTitle.toLowerCase() !== 'default title' ? currentData.variantTitle : '—',
                                    'Current Month': currentData.netItems.toLocaleString(),
                                    'Prior Month': (priorData?.netItems || 0).toLocaleString(),
                                    'Change %': formatPercent(currentData.netItems, priorData?.netItems || 0),
                                  };
                                })}
                                footerRows={[
                                  { 'SKU': '', 'Product': 'Total', 'Variant': '', 'Current Month': totalCurrentUnits.toLocaleString(), 'Prior Month': totalPriorUnits.toLocaleString(), 'Change %': formatPercent(totalCurrentUnits, totalPriorUnits), _style: 'highlight' },
                                  { 'SKU': '', 'Product': 'Avg Daily Units', 'Variant': '', 'Current Month': (totalCurrentUnits / daysInCurrent).toFixed(1), 'Prior Month': (totalPriorUnits / daysInPrior).toFixed(1), 'Change %': formatPercent(totalCurrentUnits / daysInCurrent, totalPriorUnits / daysInPrior), _style: 'default' },
                                ]}
                              />
                            )}
                            </div>
                          </details>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-slate-600 text-center py-8">
                      Month-over-month comparison requires at least 2 months of data.
                    </p>
                  )}
                </div>
              )}

              {/* Campaign Period Tab */}
              {activeTab === 'Campaign Period' && (
                <div>
                  <InsightBox insights={resolvedCampaign} />

                  {/* Campaign Summary Table */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Campaign Period Summary
                  </h3>
                  <DataTable
                    columns={[
                      'Month',
                      'Total Sales',
                      'Net Items',
                      'New Customers',
                      'Returning Customers',
                      'Category Share %',
                    ]}
                    rows={filteredMonths.map((month) => {
                      const data = monthlyTotals[month];
                      const categorySales = categoryMonthly[month]?.totalSales || 0;
                      const share = categorySales > 0
                        ? ((data.totalSales / categorySales) * 100).toFixed(1)
                        : '0.0';
                      return {
                        'Month': month,
                        'Total Sales': formatCurrency(data.totalSales),
                        'Net Items': data.netItems.toLocaleString(),
                        'New Customers': data.newCustomers.toLocaleString(),
                        'Returning Customers':
                          data.returningCustomers.toLocaleString(),
                        'Category Share %': `${share}%`,
                      };
                    })}
                  />

                  {/* Campaign Totals Row */}
                  <div className="card mt-4 bg-blue-50">
                    <div className="grid grid-cols-4 gap-4 p-4">
                      <div>
                        <p className="text-sm text-slate-600 font-semibold">
                          Total Sales
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {formatCurrency(campaignTotalSales)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-semibold">
                          Total Units
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {campaignTotalUnits.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-semibold">
                          New Customers
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {campaignNewCustomers.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-semibold">
                          Returning Customers
                        </p>
                        <p className="text-2xl font-bold text-slate-900">
                          {filteredMonths
                            .reduce(
                              (sum, m) =>
                                sum +
                                (monthlyTotals[m]?.returningCustomers || 0),
                              0
                            )
                            .toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* New vs Returning Customers Area Chart */}
                  <div className="card mt-6 mb-6" style={{ maxHeight: '350px' }}>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                      New vs Returning Customers
                    </h3>
                    <div style={{ height: '280px' }}>
                    <Line
                      data={{
                        labels: filteredMonths.map(formatMonthTitle),
                        datasets: [
                          {
                            label: 'New Customers',
                            data: filteredMonths.map((m) => monthlyTotals[m]?.newCustomers || 0),
                            borderColor: '#17A5EB',
                            backgroundColor: 'rgba(23, 165, 235, 0.15)',
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: '#17A5EB',
                            fill: true,
                            tension: 0.4,
                            order: 1,
                          },
                          {
                            label: 'Returning Customers',
                            data: filteredMonths.map((m) => monthlyTotals[m]?.returningCustomers || 0),
                            borderColor: '#88C6E6',
                            backgroundColor: 'rgba(136, 198, 230, 0.15)',
                            borderWidth: 2,
                            pointRadius: 4,
                            pointBackgroundColor: '#88C6E6',
                            fill: true,
                            tension: 0.4,
                            order: 2,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              usePointStyle: true,
                              pointStyle: 'circle',
                              padding: 20,
                              font: { size: 13 },
                            },
                          },
                          tooltip: {
                            backgroundColor: '#1a1a2e',
                            titleFont: { size: 13 },
                            bodyFont: { size: 13 },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                              label: (ctx) => `  ${ctx.dataset.label}: ${ctx.raw.toLocaleString()}`,
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 12 } },
                          },
                          y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            border: { display: false },
                            ticks: {
                              color: '#94a3b8',
                              font: { size: 12 },
                              callback: (value) => value.toLocaleString(),
                            },
                          },
                        },
                      }}
                    />
                    </div>
                  </div>

                  {/* SKU by Campaign Period - Sales/Units Toggle */}
                  <div className="flex items-center justify-between mb-4 mt-8">
                    <h3 className="text-lg font-bold text-slate-900">
                      {skuView === 'sales' ? 'Sales by SKU (Campaign Period)' : 'Units by SKU (Campaign Period)'}
                    </h3>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      {['sales', 'units'].map((view) => (
                        <button
                          key={view}
                          onClick={() => setSkuView(view)}
                          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors capitalize ${
                            skuView === view
                              ? 'bg-white text-blue-600 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {view === 'sales' ? 'Sales' : 'Units'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <DataTable
                    columns={[
                      'SKU',
                      'Product',
                      'Variant',
                      ...filteredMonths.map(formatMonthShort),
                      'Total',
                    ]}
                    rows={Object.keys(
                      Object.values(monthlySkuData)[0] || {}
                    ).map((sku) => {
                      const skuData = monthlySkuData[filteredMonths[0]][sku];
                      const row = {
                        'SKU': sku,
                        'Product': skuData?.productTitle || skuData?.skuLabel || sku,
                        'Variant': skuData?.variantTitle && skuData.variantTitle.toLowerCase() !== 'default title' ? skuData.variantTitle : '—',
                      };
                      let total = 0;
                      filteredMonths.forEach((month) => {
                        if (skuView === 'sales') {
                          const sales = monthlySkuData[month][sku]?.totalSales || 0;
                          row[formatMonthShort(month)] = formatCurrency(sales);
                          total += sales;
                        } else {
                          const units = monthlySkuData[month][sku]?.netItems || 0;
                          row[formatMonthShort(month)] = units.toLocaleString();
                          total += units;
                        }
                      });
                      row['Total'] = skuView === 'sales' ? formatCurrency(total) : total.toLocaleString();
                      return row;
                    })}
                  />
                </div>
              )}

              {/* Category Share Tab */}
              {activeTab === 'Category Share' && (
                <div>
                  <InsightBox insights={resolvedCategory} />

                  {/* Category Share Table */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Category Performance
                  </h3>
                  <DataTable
                    columns={[
                      'Month',
                      'Product Sales',
                      'Share %',
                      'Prior Year Share %',
                    ]}
                    rows={filteredMonths.map((month) => {
                      const productSales = monthlyTotals[month]?.totalSales || 0;
                      const categorySales = categoryMonthly[month]?.totalSales || 0;
                      const share = categorySales > 0
                        ? ((productSales / categorySales) * 100).toFixed(1)
                        : '0.0';
                      const prevProductSales = monthlyTotals[month]?.prevTotalSales || 0;
                      const prevCategorySales = categoryMonthly[month]?.prevTotalSales || 0;
                      const prevShare = prevCategorySales > 0
                        ? ((prevProductSales / prevCategorySales) * 100).toFixed(1)
                        : '0.0';

                      return {
                        'Month': month,
                        'Product Sales': formatCurrency(productSales),
                        'Share %': `${share}%`,
                        'Prior Year Share %': `${prevShare}%`,
                      };
                    })}
                  />

                  {/* Category Share Chart */}
                  <div className="card mt-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                      Category Share Trend
                    </h3>
                    <Line
                      data={{
                        labels: filteredMonths,
                        datasets: [
                          {
                            label: 'Current Year Share %',
                            data: filteredMonths.map((month) => {
                              const productSales =
                                monthlyTotals[month]?.totalSales || 0;
                              const categorySales =
                                categoryMonthly[month]?.totalSales || 0;
                              return categorySales > 0
                                ? (productSales / categorySales) * 100
                                : 0;
                            }),
                            borderColor: BRAND_COLORS.current,
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: BRAND_COLORS.current,
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            fill: false,
                            tension: 0.4,
                          },
                          {
                            label: 'Prior Year Share %',
                            data: filteredMonths.map((month) => {
                              const prevProductSales =
                                monthlyTotals[month]?.prevTotalSales || 0;
                              const prevCategorySales =
                                categoryMonthly[month]?.prevTotalSales || 0;
                              return prevCategorySales > 0
                                ? (prevProductSales / prevCategorySales) * 100
                                : 0;
                            }),
                            borderColor: BRAND_COLORS.previous,
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [6, 4],
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: BRAND_COLORS.previous,
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            fill: false,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              usePointStyle: true,
                              pointStyle: 'circle',
                              padding: 20,
                              font: { size: 13 },
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 12 } },
                          },
                          y: {
                            beginAtZero: true,
                            suggestedMax: 10,
                            grid: { color: '#f1f5f9' },
                            border: { display: false },
                            ticks: {
                              color: '#94a3b8',
                              font: { size: 12 },
                              callback: (value) => `${value}%`,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Export Button */}
      {!vendor?.hide_pdf_export && (
        <div className="sticky bottom-8 right-8 z-40">
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="btn-primary px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            {exporting ? 'Exporting...' : '📥 Export to PDF'}
          </button>
        </div>
      )}
    </div>
  );
}
