'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  getProductData,
  getCategoryData,
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
  current: '#0070c9',
  previous: '#94a3b8',
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

  const displayValue = isCurrency ? formatCurrency(value) : value.toLocaleString();
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
          Previous: {isCurrency ? formatCurrency(previousValue) : previousValue.toLocaleString()}
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

// Data table component
const DataTable = ({ columns, rows, className = '' }) => (
  <div className="overflow-x-auto card">
    <table className={`w-full text-sm ${className}`}>
      <thead>
        <tr className="bg-slate-50 border-b-2 border-slate-200">
          {columns.map((col) => (
            <th
              key={col}
              className="px-4 py-3 text-left font-bold text-slate-900 whitespace-nowrap"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={idx}
            className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
          >
            {columns.map((col) => (
              <td key={`${idx}-${col}`} className="px-4 py-3 text-slate-700">
                {row[col] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Main dashboard component
export default function VendorDashboard() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug;
  const dashboardRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [monthlySkuData, setMonthlySkuData] = useState({});
  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [categoryMonthly, setCategoryMonthly] = useState({});
  const [months, setMonths] = useState([]);
  const [activeTab, setActiveTab] = useState('Year-over-Year');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [filteredMonths, setFilteredMonths] = useState([]);
  const [exporting, setExporting] = useState(false);

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

        // Load product and category data
        const productRows = await getProductData(vendorId);
        const categoryRows = await getCategoryData(vendorId);

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

          restructuredSkuData[month][sku] = {
            totalSales,
            netItems,
            newCustomers,
            returningCustomers,
            prevTotalSales,
            prevNetItems,
            skuLabel: row.sku_label || sku,
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

        setMonthlySkuData(restructuredSkuData);
        setMonthlyTotals(restructuredTotals);
        setCategoryMonthly(restructuredCategoryData);
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
  }, [router, slug]);

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

  // Calculate category share
  const categoryShare =
    filteredMonths.length > 0 && campaignTotalSales > 0
      ? (
          (filteredMonths.reduce(
            (sum, m) => sum + (categoryMonthly[m]?.totalSales || 0),
            0
          ) /
            campaignTotalSales) *
          100
        ).toFixed(1)
      : 0;
  const prevCategoryShare =
    filteredMonths.length > 0 && campaignPrevSales > 0
      ? (
          (filteredMonths.reduce(
            (sum, m) => sum + (categoryMonthly[m]?.prevTotalSales || 0),
            0
          ) /
            campaignPrevSales) *
          100
        ).toFixed(1)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div ref={dashboardRef} className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                  Prepared by Your Company for {vendor.name}
                </h1>
                {vendor.product_name && (
                  <p className="text-lg text-slate-600">{vendor.product_name}</p>
                )}
              </div>
              <div className="text-right">
                <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold text-sm">
                  {filteredMonths[0]} to {filteredMonths[filteredMonths.length - 1]}
                </div>
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
          <InsightBox insights={executiveSummary} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Total Campaign Sales"
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
            <KPICard
              title="Category Share"
              value={parseFloat(categoryShare)}
              previousValue={parseFloat(prevCategoryShare)}
              isPercentage
            />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <TabNavigation
              tabs={[
                'Year-over-Year',
                'Month-over-Month',
                'Campaign Period',
                'Category Share',
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
                  <InsightBox insights={yoyInsights} />

                  {/* YoY Sales Chart */}
                  <div className="card mb-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                      Sales Comparison by Month
                    </h3>
                    <Bar
                      data={{
                        labels: filteredMonths,
                        datasets: [
                          {
                            label: 'Current Year',
                            data: filteredMonths.map(
                              (m) => monthlyTotals[m]?.totalSales || 0
                            ),
                            backgroundColor: BRAND_COLORS.current,
                          },
                          {
                            label: 'Prior Year',
                            data: filteredMonths.map(
                              (m) => monthlyTotals[m]?.prevTotalSales || 0
                            ),
                            backgroundColor: BRAND_COLORS.previous,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top',
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                          },
                        },
                      }}
                    />
                  </div>

                  {/* Sales by SKU Table */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Sales by SKU
                  </h3>
                  <DataTable
                    columns={['Month', 'SKU Label', 'Current Sales', 'Prior Year Sales', 'Change %']}
                    rows={filteredMonths.flatMap((month) =>
                      Object.keys(monthlySkuData[month] || {}).map((sku) => {
                        const data = monthlySkuData[month][sku];
                        return {
                          'Month': month,
                          'SKU Label': data.skuLabel,
                          'Current Sales': formatCurrency(data.totalSales),
                          'Prior Year Sales': formatCurrency(data.prevTotalSales),
                          'Change %': formatPercent(
                            data.totalSales,
                            data.prevTotalSales
                          ),
                        };
                      })
                    )}
                  />

                  {/* Quantity by SKU Table */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4 mt-6">
                    Units Sold by SKU
                  </h3>
                  <DataTable
                    columns={['Month', 'SKU Label', 'Current Units', 'Prior Year Units', 'Change %']}
                    rows={filteredMonths.flatMap((month) =>
                      Object.keys(monthlySkuData[month] || {}).map((sku) => {
                        const data = monthlySkuData[month][sku];
                        return {
                          'Month': month,
                          'SKU Label': data.skuLabel,
                          'Current Units': data.netItems.toLocaleString(),
                          'Prior Year Units': data.prevNetItems.toLocaleString(),
                          'Change %': formatPercent(
                            data.netItems,
                            data.prevNetItems
                          ),
                        };
                      })
                    )}
                  />
                </div>
              )}

              {/* Month-over-Month Tab */}
              {activeTab === 'Month-over-Month' && (
                <div>
                  <InsightBox insights={momInsights} />

                  {filteredMonths.length > 1 ? (
                    <>
                      {filteredMonths.map((month, idx) => {
                        if (idx === 0) return null;
                        const prevMonth = filteredMonths[idx - 1];

                        return (
                          <div key={month} className="mb-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">
                              {prevMonth} → {month}
                            </h3>

                            {/* MoM Sales Comparison */}
                            <h4 className="text-md font-semibold text-slate-800 mb-3">
                              Sales Comparison
                            </h4>
                            <DataTable
                              columns={['SKU Label', 'Current Month', 'Prior Month', 'Change %']}
                              rows={Object.keys(
                                monthlySkuData[month] || {}
                              ).map((sku) => {
                                const currentData = monthlySkuData[month][sku];
                                const priorData = monthlySkuData[prevMonth][sku];
                                return {
                                  'SKU Label': currentData.skuLabel,
                                  'Current Month': formatCurrency(
                                    currentData.totalSales
                                  ),
                                  'Prior Month': formatCurrency(
                                    priorData.totalSales
                                  ),
                                  'Change %': formatPercent(
                                    currentData.totalSales,
                                    priorData.totalSales
                                  ),
                                };
                              })}
                            />

                            {/* MoM Quantity Comparison */}
                            <h4 className="text-md font-semibold text-slate-800 mb-3 mt-6">
                              Units Sold Comparison
                            </h4>
                            <DataTable
                              columns={['SKU Label', 'Current Month', 'Prior Month', 'Change %']}
                              rows={Object.keys(
                                monthlySkuData[month] || {}
                              ).map((sku) => {
                                const currentData = monthlySkuData[month][sku];
                                const priorData = monthlySkuData[prevMonth][sku];
                                return {
                                  'SKU Label': currentData.skuLabel,
                                  'Current Month':
                                    currentData.netItems.toLocaleString(),
                                  'Prior Month': priorData.netItems.toLocaleString(),
                                  'Change %': formatPercent(
                                    currentData.netItems,
                                    priorData.netItems
                                  ),
                                };
                              })}
                            />
                          </div>
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
                  <InsightBox insights={campaignInsights} />

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
                    ]}
                    rows={filteredMonths.map((month) => {
                      const data = monthlyTotals[month];
                      return {
                        'Month': month,
                        'Total Sales': formatCurrency(data.totalSales),
                        'Net Items': data.netItems.toLocaleString(),
                        'New Customers': data.newCustomers.toLocaleString(),
                        'Returning Customers':
                          data.returningCustomers.toLocaleString(),
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

                  {/* Sales by SKU across campaign */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4 mt-8">
                    Sales by SKU (Campaign Period)
                  </h3>
                  <DataTable
                    columns={[
                      'SKU Label',
                      ...filteredMonths,
                      'Total',
                    ]}
                    rows={Object.keys(
                      Object.values(monthlySkuData)[0] || {}
                    ).map((sku) => {
                      const skuLabel = monthlySkuData[filteredMonths[0]][sku]
                        ?.skuLabel;
                      const row = {
                        'SKU Label': skuLabel,
                      };
                      let total = 0;
                      filteredMonths.forEach((month) => {
                        const sales = monthlySkuData[month][sku]?.totalSales || 0;
                        row[month] = formatCurrency(sales);
                        total += sales;
                      });
                      row['Total'] = formatCurrency(total);
                      return row;
                    })}
                  />

                  {/* Quantity by SKU across campaign */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4 mt-8">
                    Units by SKU (Campaign Period)
                  </h3>
                  <DataTable
                    columns={[
                      'SKU Label',
                      ...filteredMonths,
                      'Total',
                    ]}
                    rows={Object.keys(
                      Object.values(monthlySkuData)[0] || {}
                    ).map((sku) => {
                      const skuLabel = monthlySkuData[filteredMonths[0]][sku]
                        ?.skuLabel;
                      const row = {
                        'SKU Label': skuLabel,
                      };
                      let total = 0;
                      filteredMonths.forEach((month) => {
                        const units = monthlySkuData[month][sku]?.netItems || 0;
                        row[month] = units.toLocaleString();
                        total += units;
                      });
                      row['Total'] = total.toLocaleString();
                      return row;
                    })}
                  />
                </div>
              )}

              {/* Category Share Tab */}
              {activeTab === 'Category Share' && (
                <div>
                  <InsightBox insights={categoryInsights} />

                  {/* Category Share Table */}
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Category Performance
                  </h3>
                  <DataTable
                    columns={[
                      'Month',
                      'Product Sales',
                      'Category Sales',
                      'Share %',
                      'Prior Year Share %',
                    ]}
                    rows={filteredMonths.map((month) => {
                      const productSales = monthlyTotals[month]?.totalSales || 0;
                      const categorySales = categoryMonthly[month]?.totalSales || 0;
                      const share = productSales > 0
                        ? ((categorySales / productSales) * 100).toFixed(1)
                        : '0.0';
                      const prevProductSales = monthlyTotals[month]?.prevTotalSales || 0;
                      const prevCategorySales = categoryMonthly[month]?.prevTotalSales || 0;
                      const prevShare = prevProductSales > 0
                        ? ((prevCategorySales / prevProductSales) * 100).toFixed(1)
                        : '0.0';

                      return {
                        'Month': month,
                        'Product Sales': formatCurrency(productSales),
                        'Category Sales': formatCurrency(categorySales),
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
                              return productSales > 0
                                ? (categorySales / productSales) * 100
                                : 0;
                            }),
                            borderColor: BRAND_COLORS.current,
                            backgroundColor: `${BRAND_COLORS.current}20`,
                            fill: true,
                            tension: 0.4,
                          },
                          {
                            label: 'Prior Year Share %',
                            data: filteredMonths.map((month) => {
                              const prevProductSales =
                                monthlyTotals[month]?.prevTotalSales || 0;
                              const prevCategorySales =
                                categoryMonthly[month]?.prevTotalSales || 0;
                              return prevProductSales > 0
                                ? (prevCategorySales / prevProductSales) * 100
                                : 0;
                            }),
                            borderColor: BRAND_COLORS.previous,
                            backgroundColor: `${BRAND_COLORS.previous}20`,
                            fill: true,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top',
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
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
      <div className="sticky bottom-8 right-8 z-40">
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="btn-primary px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          {exporting ? 'Exporting...' : '📥 Export to PDF'}
        </button>
      </div>
    </div>
  );
}
