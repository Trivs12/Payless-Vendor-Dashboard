/**
 * Narrative Insights Engine
 * Generates human-readable narrative insights for vendor campaign performance
 * Auto-generated insights for dashboard reporting
 */

// Helper: Format currency as CAD
const formatCurrency = (value) => {
  if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
    return '$0';
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Helper: Format percentage
const formatPct = (current, previous) => {
  const cur = current || 0;
  const prev = previous || 0;
  if (prev === 0) {
    return cur > 0 ? 'new market entry' : '0%';
  }
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  if (isNaN(pct)) return '0%';
  return `${pct}%`;
};

// Helper: Format percentage for display (handles N/A cases)
const formatPctDisplay = (pct) => {
  if (pct === 'new market entry') {
    return pct;
  }
  return pct;
};

// Helper: Find month with highest value
const findPeakMonth = (data, key) => {
  if (!data || data.length === 0) return null;
  return data.reduce((max, item) => {
    const currentValue = item.current?.[key] ?? item[key] ?? 0;
    const maxValue = max.current?.[key] ?? max[key] ?? 0;
    return currentValue > maxValue ? item : max;
  });
};

// Helper: Find top performing SKU
const findTopSKU = (skuData) => {
  if (!skuData || Object.keys(skuData).length === 0) return null;
  let topSku = null;
  let maxGrowth = -Infinity;

  for (const [sku, data] of Object.entries(skuData)) {
    const current = data.current || 0;
    const previous = data.previous || 0;
    // Skip SKUs with no meaningful data or near-zero previous (avoids 999999% growth)
    if (current === 0 && previous === 0) continue;
    const growth = previous > 0
      ? ((current - previous) / Math.abs(previous)) * 100
      : (current > 0 ? 100 : 0);
    if (growth > maxGrowth) {
      maxGrowth = growth;
      topSku = { sku, label: data.label || sku, growth, current, previous };
    }
  }
  return topSku;
};

// Helper: Calculate overall growth trend
const calculateTrend = (data, key) => {
  if (!data || data.length < 2) return null;
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((sum, item) => sum + (item.current?.[key] ?? item[key] ?? 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, item) => sum + (item.current?.[key] ?? item[key] ?? 0), 0) / secondHalf.length;

  if (firstAvg === 0) return secondAvg > 0 ? 'accelerating' : 'flat';
  const trendPct = ((secondAvg - firstAvg) / firstAvg) * 100;
  if (trendPct > 10) return 'accelerating';
  if (trendPct < -10) return 'decelerating';
  return 'steady';
};

/**
 * Generate Year-over-Year Insights
 * @param {Array} yoyData - Array of monthly YoY comparison objects
 * @returns {string} 2-4 sentence narrative
 */
export const generateYoYInsights = (yoyData) => {
  if (!yoyData || yoyData.length === 0) {
    return 'Insufficient data to generate year-over-year insights.';
  }

  const sentences = [];

  // Find strongest growth month
  const peakMonth = findPeakMonth(yoyData, 'totalSales');
  if (peakMonth && peakMonth.current) {
    const currentSales = peakMonth.current.totalSales || 0;
    const previousSales = peakMonth.previous?.totalSales || 0;
    const growth = formatPct(currentSales, previousSales);
    const monthName = peakMonth.month;
    if (growth === 'new market entry') {
      sentences.push(
        `${monthName} demonstrated the strongest performance, reaching ${formatCurrency(currentSales)} in revenue as a new market entry.`
      );
    } else {
      sentences.push(
        `${monthName} demonstrated the strongest performance with ${growth} revenue growth, reaching ${formatCurrency(currentSales)}.`
      );
    }
  }

  // Calculate overall sales trajectory
  const totalCurrentSales = yoyData.reduce((sum, item) => sum + item.current.totalSales, 0);
  const totalPreviousSales = yoyData.reduce((sum, item) => sum + item.previous.totalSales, 0);
  const overallGrowth = formatPct(totalCurrentSales, totalPreviousSales);

  if (overallGrowth === 'new market entry') {
    sentences.push(`The campaign period marked the establishment of market presence with total revenue of ${formatCurrency(totalCurrentSales)}.`);
  } else {
    sentences.push(`Overall revenue trajectory shows ${overallGrowth} growth period-over-period, reflecting sustained market momentum.`);
  }

  // Notable SKU performance
  let allSkuData = {};
  yoyData.forEach((item) => {
    if (item.skuData) {
      allSkuData = { ...allSkuData, ...item.skuData };
    }
  });

  const topSku = findTopSKU(allSkuData);
  if (topSku && topSku.label) {
    const skuGrowth = Math.round(topSku.growth);
    if (topSku.previous === 0) {
      sentences.push(
        `${topSku.label} emerged as a new product entry with ${formatCurrency(topSku.current)} in revenue.`
      );
    } else {
      sentences.push(
        `${topSku.label} emerged as the top performer with ${skuGrowth}% growth, validating this product's market demand.`
      );
    }
  }

  // Add trend analysis
  const trend = calculateTrend(yoyData, 'totalSales');
  if (trend === 'accelerating') {
    sentences.push('Performance metrics show an accelerating trend, indicating growing customer engagement and market traction.');
  } else if (trend === 'decelerating') {
    sentences.push('While early period performance was strong, metrics show some deceleration in later months, suggesting market adjustment.');
  }

  return sentences.slice(0, 4).join(' ');
};

/**
 * Generate Month-over-Month Insights
 * @param {Array} momData - Array of monthly comparison objects
 * @returns {string} 2-3 sentence narrative
 */
export const generateMoMInsights = (momData) => {
  if (!momData || momData.length === 0) {
    return 'Insufficient data to generate month-over-month insights.';
  }

  const sentences = [];

  // Find the most recent month pair
  const latestComparison = momData[momData.length - 1];
  if (latestComparison) {
    const { month1, month2, month1Data, month2Data, change } = latestComparison;

    if (change && change.salesPct !== undefined) {
      const direction = change.salesPct >= 0 ? 'growth' : 'decline';
      const momentum = Math.abs(change.salesPct);
      sentences.push(
        `Most recent month-over-month comparison shows ${momentum}% ${direction}, indicating ${
          momentum > 15 ? 'strong momentum' : momentum > 5 ? 'positive momentum' : 'stabilizing'
        } between ${month1} and ${month2}.`
      );
    }
  }

  // Calculate trend across all months
  const allSalesChanges = momData
    .map((item) => item.change?.salesPct ?? 0)
    .filter((val) => val !== null && val !== undefined);

  if (allSalesChanges.length > 1) {
    const positiveMonths = allSalesChanges.filter((val) => val > 0).length;
    const totalMonths = allSalesChanges.length;

    if (positiveMonths === totalMonths) {
      sentences.push('Every tracked month-over-month period demonstrated positive growth, showing consistent upward momentum.');
    } else if (positiveMonths > totalMonths / 2) {
      sentences.push(`${positiveMonths} of ${totalMonths} tracked periods showed growth, reflecting overall positive trajectory with some volatility.`);
    } else if (positiveMonths > 0) {
      sentences.push(`Growth was intermittent with ${positiveMonths} positive periods, suggesting market cyclicality or competitive pressures.`);
    } else {
      sentences.push('Month-over-month performance shows consistent pressure, warranting strategic review of market positioning.');
    }
  }

  // Item velocity analysis
  const latestItems = latestComparison?.change?.itemsPct;
  if (latestItems !== undefined) {
    const itemMomentum = latestItems >= 0 ? 'acceleration' : 'slight deceleration';
    sentences.push(`Unit velocity indicates ${itemMomentum} with ${Math.abs(Math.round(latestItems))}% movement in volume.`);
  }

  return sentences.slice(0, 3).join(' ');
};

/**
 * Generate Campaign Investment Insights
 * @param {Object} campaignData - Campaign performance metrics
 * @returns {string} 3-5 sentence narrative
 */
export const generateCampaignInsights = (campaignData) => {
  if (!campaignData) {
    return 'Insufficient campaign data to generate insights.';
  }

  const {
    totalSales,
    prevTotalSales,
    netItems: totalItems,
    prevNetItems: prevTotalItems,
    newCustomers: totalNewCustomers,
    returningCustomers: totalReturningCustomers,
    prevNewCustomers,
    prevReturningCustomers,
    categoryShare,
    prevCategoryShare,
    months,
    monthlyBudget,
    showBudget,
  } = campaignData;

  const sentences = [];

  // Investment framing
  if (showBudget && monthlyBudget && months) {
    const totalInvested = monthlyBudget * months;
    sentences.push(
      `This campaign period represents a ${formatCurrency(monthlyBudget)} monthly investment over ${months} months, totaling ${formatCurrency(
        totalInvested
      )} in ad spend.`
    );
  }

  // Total growth narrative
  if (totalSales !== undefined && prevTotalSales !== undefined) {
    const salesGrowth = formatPct(totalSales, prevTotalSales);
    if (salesGrowth === 'new market entry') {
      sentences.push(`The campaign successfully established market presence, generating ${formatCurrency(totalSales)} in total revenue.`);
    } else {
      sentences.push(
        `Campaign period delivered ${salesGrowth} revenue growth, reaching ${formatCurrency(totalSales)} compared to ${formatCurrency(
          prevTotalSales
        )} in the prior period.`
      );
    }
  }

  // Customer acquisition success
  if (totalNewCustomers !== undefined && prevNewCustomers !== undefined) {
    const newCustGrowth = formatPct(totalNewCustomers, prevNewCustomers);
    const returnCustGrowth = formatPct(totalReturningCustomers, prevReturningCustomers);

    if (newCustGrowth === 'new market entry') {
      sentences.push(
        `Customer acquisition strategy successfully onboarded ${totalNewCustomers} new customers, establishing a foundation for recurring revenue with ${totalReturningCustomers} returning customers.`
      );
    } else {
      sentences.push(
        `Customer acquisition shows ${newCustGrowth} new customer growth with ${totalNewCustomers} total new customers, while returning customer base grew ${returnCustGrowth}, indicating strong customer retention.`
      );
    }
  }

  // Category share gains
  if (categoryShare !== undefined && prevCategoryShare !== undefined && prevCategoryShare > 0) {
    const sharePct = categoryShare - prevCategoryShare;
    if (sharePct > 0) {
      sentences.push(
        `Market share within category expanded by ${sharePct.toFixed(1)} percentage points to ${categoryShare.toFixed(1)}%, demonstrating competitive positioning gains.`
      );
    } else if (sharePct < 0) {
      sentences.push(
        `Category share adjusted to ${categoryShare.toFixed(1)}% from ${prevCategoryShare.toFixed(1)}%, reflecting market dynamics and competitive activity.`
      );
    }
  }

  // Unit volume perspective
  if (totalItems !== undefined && prevTotalItems !== undefined) {
    const itemsGrowth = formatPct(totalItems, prevTotalItems);
    if (itemsGrowth !== 'new market entry') {
      sentences.push(
        `Unit volume demonstrates ${itemsGrowth} growth with ${totalItems} net items sold, validating campaign effectiveness in driving customer purchases.`
      );
    }
  }

  return sentences.slice(0, 5).join(' ');
};

/**
 * Generate Category Share Insights
 * @param {Object} categoryData - Monthly category share data { month: { share, prevShare } }
 * @returns {string} 1-2 sentence narrative
 */
export const generateCategoryInsights = (categoryData) => {
  if (!categoryData || Object.keys(categoryData).length === 0) {
    return 'Insufficient category data to generate insights.';
  }

  const sentences = [];

  // Get all share changes
  const shareChanges = Object.entries(categoryData).map(([month, data]) => ({
    month,
    change: data.share - data.prevShare,
    share: data.share,
  }));

  // Average share and trend
  const avgChange = shareChanges.reduce((sum, item) => sum + item.change, 0) / shareChanges.length;
  const maxShare = Math.max(...shareChanges.map((item) => item.share));

  if (avgChange > 0.5) {
    sentences.push(
      `Category share demonstrates consistent expansion with an average monthly gain of ${avgChange.toFixed(1)} percentage points, peaking at ${maxShare.toFixed(
        1
      )}% market penetration.`
    );
  } else if (avgChange < -0.5) {
    sentences.push(
      `Category share shows contraction across the measurement period, with market position adjusting by an average of ${avgChange.toFixed(
        1
      )} percentage points monthly.`
    );
  } else {
    sentences.push(
      `Category share remains relatively stable at approximately ${maxShare.toFixed(1)}%, reflecting consistent market positioning.`
    );
  }

  return sentences[0];
};

/**
 * Generate Executive Summary
 * @param {Array} yoyData - Year-over-year data
 * @param {Object} campaignData - Campaign performance data
 * @returns {string} 2-3 sentence executive summary
 */
export const generateExecutiveSummary = (yoyData, campaignData) => {
  if (!yoyData || !campaignData) {
    return 'Insufficient data to generate executive summary.';
  }

  const sentences = [];

  // Calculate headline metrics
  const totalSales = campaignData.totalSales || 0;
  const prevSales = campaignData.prevTotalSales || 0;
  const totalNewCustomers = campaignData.newCustomers || 0;
  const totalReturningCustomers = campaignData.returningCustomers || 0;
  const growth = formatPct(totalSales, prevSales);

  // Opening statement
  if (growth === 'new market entry') {
    sentences.push(
      `This campaign period successfully established a new market entry, generating ${formatCurrency(totalSales)} in total revenue and acquiring ${totalNewCustomers} new customers.`
    );
  } else if (growth !== 'N/A') {
    sentences.push(
      `Campaign performance delivered ${growth} revenue growth to ${formatCurrency(totalSales)}, with customer acquisition reaching ${totalNewCustomers} new customers.`
    );
  } else {
    sentences.push(`Campaign period generated ${formatCurrency(totalSales)} in revenue with strong customer acquisition metrics.`);
  }

  // Business impact statement
  const returnCustGrowth = campaignData.prevReturningCustomers
    ? formatPct(totalReturningCustomers, campaignData.prevReturningCustomers)
    : 'N/A';

  if (returnCustGrowth !== 'N/A' && returnCustGrowth !== 'new market entry') {
    sentences.push(
      `Product-market fit is evidenced by ${returnCustGrowth} growth in returning customers, demonstrating both new customer acquisition and sustainable repeat business.`
    );
  } else {
    sentences.push(
      `The results demonstrate strong product-market alignment with successful customer acquisition and engagement throughout the campaign period.`
    );
  }

  // Momentum statement
  const trend = calculateTrend(yoyData, 'totalSales');
  if (trend === 'accelerating') {
    sentences.push('Upward momentum suggests the campaign has established a strong foundation for continued growth.');
  } else if (trend === 'steady') {
    sentences.push('Steady performance metrics indicate stable market positioning and consistent customer engagement.');
  }

  return sentences.slice(0, 3).join(' ');
};

export default {
  generateYoYInsights,
  generateMoMInsights,
  generateCampaignInsights,
  generateCategoryInsights,
  generateExecutiveSummary,
  formatCurrency,
  formatPct,
};
