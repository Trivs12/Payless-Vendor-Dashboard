'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  getReportsByVendorId,
  createReport,
  updateReport,
  deleteReport,
  setDefaultReport,
  saveProductData,
  saveDailyProductData,
  saveCategoryData,
  saveUploadHistory,
  getUploadHistory,
  getAppSetting,
  saveAppSetting,
  getSkuTitleMap,
  saveSkuTitleMap,
  deleteSkuTitleMapping,
  saveCustomerData,
} from '@/lib/supabase';
import { parseProductCSV, parseCategoryCSV, parseCustomerCSV } from '@/lib/dataProcessing';

export default function AdminPage() {
  const router = useRouter();

  // Auth state
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Vendors and UI state
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Reports state
  const [vendorReports, setVendorReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [reportFormData, setReportFormData] = useState({
    name: '',
    product_name: '',
    category_name: '',
    is_default: false,
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [showDeleteReportConfirm, setShowDeleteReportConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    password: '',
    monthly_budget: '',
    show_budget: false,
    hide_pdf_export: false,
    hide_category_tab: false,
    campaign_start: '',
    campaign_end: '',
    notes: '',
  });

  // Company logo state
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyLogoSaving, setCompanyLogoSaving] = useState(false);
  const [loginLogo, setLoginLogo] = useState(null);
  const [loginLogoSaving, setLoginLogoSaving] = useState(false);

  // Admin password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // SKU title mapping state
  const [titleMappings, setTitleMappings] = useState([]);
  const [editingMappings, setEditingMappings] = useState([]);

  // Custom insights state
  const [insightsEditing, setInsightsEditing] = useState({
    executive: { hidden: false, text: '' },
    yoy: { hidden: false, text: '' },
    mom: { hidden: false, text: '' },
    campaign: { hidden: false, text: '' },
    category: { hidden: false, text: '' },
  });
  const [insightsSaving, setInsightsSaving] = useState(false);

  // CSV upload states
  const [selectedTab, setSelectedTab] = useState('settings');
  const [productCSVFile, setProductCSVFile] = useState(null);
  const [categoryCSVFile, setCategoryCSVFile] = useState(null);
  const [customerCSVFile, setCustomerCSVFile] = useState(null);
  const [csvPreview, setCSVPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);

  // Auth check on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authData = sessionStorage.getItem('auth');
        if (!authData) {
          router.push('/');
          return;
        }
        const auth = JSON.parse(authData);
        if (auth.role !== 'admin') {
          router.push('/');
          return;
        }
        setIsAuthorized(true);
      } catch (err) {
        router.push('/');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  // Load vendors and company logo on mount
  useEffect(() => {
    if (isAuthorized) {
      loadVendors();
      loadCompanyLogo();
      loadLoginLogo();
    }
  }, [isAuthorized]);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const loadCompanyLogo = async () => {
    try {
      const logo = await getAppSetting('company_logo');
      if (logo) setCompanyLogo(logo);
    } catch (err) {
      console.error('Failed to load company logo:', err);
    }
  };

  const loadLoginLogo = async () => {
    try {
      const logo = await getAppSetting('login_logo');
      if (logo) setLoginLogo(logo);
    } catch (err) {
      console.error('Failed to load login logo:', err);
    }
  };

  const handleCompanyLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompanyLogoSaving(true);
      const base64 = await fileToBase64(file);
      await saveAppSetting('company_logo', base64);
      setCompanyLogo(base64);
      setSuccess('Company logo saved');
    } catch (err) {
      setError('Failed to save company logo');
    } finally {
      setCompanyLogoSaving(false);
    }
  };

  const handleLoginLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoginLogoSaving(true);
      const base64 = await fileToBase64(file);
      await saveAppSetting('login_logo', base64);
      setLoginLogo(base64);
      setSuccess('Login page logo saved');
    } catch (err) {
      setError('Failed to save login page logo');
    } finally {
      setLoginLogoSaving(false);
    }
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setPasswordSaving(true);
      setError(null);
      await saveAppSetting('admin_password', newPassword);
      setSuccess('Admin password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to update admin password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleVendorLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVendor) return;
    try {
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({ ...prev, logo_url: base64 }));
    } catch (err) {
      setError('Failed to read logo file');
    }
  };

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendors();
      setVendors(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load vendors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorReports = async (vendorId) => {
    try {
      const reports = await getReportsByVendorId(vendorId);
      setVendorReports(reports || []);
      // Auto-select first report (default is first since sorted by is_default desc)
      if (reports && reports.length > 0) {
        setSelectedReport(reports[0]);
        loadInsights(reports[0]);
      } else {
        setSelectedReport(null);
      }
      return reports || [];
    } catch (err) {
      console.error('Failed to load reports:', err);
      setVendorReports([]);
      setSelectedReport(null);
      return [];
    }
  };

  const loadUploadHistory = async (reportId) => {
    if (!reportId) {
      setUploadHistory([]);
      return;
    }
    try {
      const history = await getUploadHistory(reportId);
      setUploadHistory(history || []);
    } catch (err) {
      console.error('Failed to load upload history:', err);
      setUploadHistory([]);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (e) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
    }));
  };

  const loadTitleMappings = async (reportId) => {
    if (!reportId) {
      setTitleMappings([]);
      setEditingMappings([]);
      return;
    }
    try {
      const mappings = await getSkuTitleMap(reportId);
      setTitleMappings(mappings);
      setEditingMappings(mappings.map((m) => ({ ...m })));
    } catch (err) {
      console.error('Failed to load title mappings:', err);
      setTitleMappings([]);
      setEditingMappings([]);
    }
  };

  // Handle vendor selection
  const handleSelectVendor = async (vendor) => {
    setSelectedVendor(vendor);
    setFormData(vendor);
    setSelectedTab('settings');
    setProductCSVFile(null);
    setCategoryCSVFile(null);
    setCSVPreview(null);
    const reports = await loadVendorReports(vendor.id);
    if (reports.length > 0) {
      loadUploadHistory(reports[0].id);
      loadTitleMappings(reports[0].id);
    } else {
      setUploadHistory([]);
      setTitleMappings([]);
      setEditingMappings([]);
    }
  };

  // Handle report selection change (for upload/history/titles/insights tabs)
  const handleReportSelect = (reportId) => {
    const report = vendorReports.find((r) => r.id === reportId);
    setSelectedReport(report || null);
    if (report) {
      loadUploadHistory(report.id);
      loadTitleMappings(report.id);
      loadInsights(report);
    }
  };

  const loadInsights = (report) => {
    const defaults = { hidden: false, text: '' };
    const ci = report?.custom_insights || {};
    setInsightsEditing({
      executive: { ...defaults, ...ci.executive },
      yoy: { ...defaults, ...ci.yoy },
      mom: { ...defaults, ...ci.mom },
      campaign: { ...defaults, ...ci.campaign },
      category: { ...defaults, ...ci.category },
    });
  };

  const handleSaveInsights = async () => {
    if (!selectedReport) return;
    try {
      setInsightsSaving(true);
      const updated = await updateReport(selectedReport.id, { custom_insights: insightsEditing });
      // Update report in local state
      setVendorReports((prev) =>
        prev.map((r) => (r.id === selectedReport.id ? { ...r, custom_insights: insightsEditing } : r))
      );
      setSelectedReport({ ...selectedReport, custom_insights: insightsEditing });
      setSuccess('Key insights saved');
    } catch (err) {
      setError('Failed to save key insights');
    } finally {
      setInsightsSaving(false);
    }
  };

  // Handle create/edit form submission
  const handleSaveVendor = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!formData.name || !formData.slug || !formData.password) {
        setError('Name, slug, and password are required');
        return;
      }

      setLoading(true);

      const sanitized = {
        ...formData,
        monthly_budget: formData.monthly_budget === '' ? null : parseFloat(formData.monthly_budget),
        campaign_start: formData.campaign_start || null,
        campaign_end: formData.campaign_end || null,
        notes: formData.notes || null,
      };
      // Remove product_name and category_name — they live on reports now
      delete sanitized.product_name;
      delete sanitized.category_name;

      if (selectedVendor?.id) {
        await updateVendor(selectedVendor.id, sanitized);
        setSuccess('Vendor updated successfully');
      } else {
        await createVendor(sanitized);
        setSuccess('Vendor created successfully');
        setFormData({
          name: '',
          slug: '',
          password: '',
          monthly_budget: '',
          show_budget: false,
          hide_pdf_export: false,
          hide_category_tab: false,
          campaign_start: '',
          campaign_end: '',
          notes: '',
        });
        setShowCreateModal(false);
      }

      await loadVendors();
    } catch (err) {
      setError(err.message || 'Failed to save vendor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle vendor deletion
  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;

    try {
      setLoading(true);
      await deleteVendor(vendorToDelete.id);
      setSuccess('Vendor deleted successfully');
      setShowDeleteConfirm(false);
      setVendorToDelete(null);
      setSelectedVendor(null);
      setVendorReports([]);
      setSelectedReport(null);
      await loadVendors();
    } catch (err) {
      setError('Failed to delete vendor');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Report CRUD handlers
  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!selectedVendor) return;
    setError(null);
    setSuccess(null);

    try {
      if (!reportFormData.name) {
        setError('Report name is required');
        return;
      }
      setLoading(true);

      if (editingReport) {
        await updateReport(editingReport.id, {
          name: reportFormData.name,
          product_name: reportFormData.product_name || null,
          category_name: reportFormData.category_name || null,
          is_default: reportFormData.is_default,
        });
        if (reportFormData.is_default) {
          await setDefaultReport(selectedVendor.id, editingReport.id);
        }
        setSuccess('Report updated');
      } else {
        const newReport = await createReport(selectedVendor.id, {
          name: reportFormData.name,
          product_name: reportFormData.product_name || null,
          category_name: reportFormData.category_name || null,
          is_default: reportFormData.is_default,
        });
        setSuccess('Report created');
      }

      setShowCreateReportModal(false);
      setEditingReport(null);
      setReportFormData({ name: '', product_name: '', category_name: '', is_default: false });
      await loadVendorReports(selectedVendor.id);
    } catch (err) {
      setError(err.message || 'Failed to save report');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    try {
      setLoading(true);
      await deleteReport(reportToDelete.id);
      setSuccess('Report deleted');
      setShowDeleteReportConfirm(false);
      setReportToDelete(null);
      await loadVendorReports(selectedVendor.id);
    } catch (err) {
      setError('Failed to delete report');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (reportId) => {
    if (!selectedVendor) return;
    try {
      setLoading(true);
      await setDefaultReport(selectedVendor.id, reportId);
      setSuccess('Default report updated');
      await loadVendorReports(selectedVendor.id);
    } catch (err) {
      setError('Failed to set default');
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV uploads
  const handleCSVUpload = async (e) => {
    e.preventDefault();
    if (!selectedVendor) {
      setError('Please select a vendor first');
      return;
    }
    if (!selectedReport) {
      setError('Please select a report first');
      return;
    }

    if (!productCSVFile && !categoryCSVFile && !customerCSVFile) {
      setError('Please select at least one CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const reportId = selectedReport.id;

      // Process product CSV if provided
      if (productCSVFile) {
        const productText = await productCSVFile.text();
        const productData = parseProductCSV(productText);

        await saveProductData(reportId, productData.monthlySkuData);

        if (productData.dailyTotals && Object.keys(productData.dailyTotals).length > 0) {
          await saveDailyProductData(reportId, productData.dailyTotals);
        }

        const months = productData.months || [];
        if (months.length > 0) {
          const dateRange = `${months[0]} to ${months[months.length - 1]}`;
          await saveUploadHistory(
            reportId,
            'product',
            productCSVFile.name,
            productText.split('\n').length - 1,
            dateRange
          );
        }
      }

      // Process category CSV if provided
      if (categoryCSVFile) {
        const categoryText = await categoryCSVFile.text();
        const categoryData = parseCategoryCSV(categoryText);

        await saveCategoryData(reportId, categoryData);

        const categoryMonths = Object.keys(categoryData);
        if (categoryMonths.length > 0) {
          const dateRange = `${categoryMonths.sort()[0]} to ${categoryMonths.sort().pop()}`;
          await saveUploadHistory(
            reportId,
            'category',
            categoryCSVFile.name,
            categoryMonths.length,
            dateRange
          );
        }
      }

      // Process customer CSV if provided
      if (customerCSVFile) {
        const customerText = await customerCSVFile.text();
        const { monthly: customerData, periodTotals } = parseCustomerCSV(customerText);

        // Include period-level unique counts as a special '_period' row
        const dataWithPeriod = {
          ...customerData,
          '_period': {
            newCustomers: 0,
            returningCustomers: periodTotals.uniqueReturningCustomers,
            prevNewCustomers: 0,
            prevReturningCustomers: periodTotals.prevUniqueReturningCustomers,
          },
        };
        await saveCustomerData(reportId, dataWithPeriod);

        const customerMonths = Object.keys(customerData).sort();
        if (customerMonths.length > 0) {
          const dateRange = `${customerMonths[0]} to ${customerMonths[customerMonths.length - 1]}`;
          await saveUploadHistory(
            reportId,
            'customer',
            customerCSVFile.name,
            customerText.split('\n').length - 1,
            dateRange
          );
        }
      }

      setSuccess('Files uploaded and processed successfully');
      setProductCSVFile(null);
      setCategoryCSVFile(null);
      setCustomerCSVFile(null);
      setCSVPreview(null);
      await loadUploadHistory(reportId);
    } catch (err) {
      setError(err.message || 'Failed to process CSV files');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // Preview CSV files
  const handleCSVFileChange = (fileInput, isProduct) => {
    const file = fileInput.target.files?.[0];
    if (!file) return;

    if (isProduct) {
      setProductCSVFile(file);
    } else {
      setCategoryCSVFile(file);
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result;
        if (isProduct && productCSVFile) {
          const parsed = parseProductCSV(csvText);
          const months = parsed.months || [];
          setCSVPreview({
            type: 'product',
            months: months.length,
            skus: (parsed.targetSkus || []).length,
            rows: csvText.split('\n').length - 1,
            dateRange: months.length > 0 ? `${months[0]} to ${months[months.length - 1]}` : 'N/A',
          });
        } else if (!isProduct && categoryCSVFile) {
          const parsed = parseCategoryCSV(csvText);
          setCSVPreview({
            type: 'category',
            months: 1,
            rows: parsed?.length || 0,
            dateRange: new Date().toISOString().split('T')[0],
          });
        }
      } catch (err) {
        console.error('Error previewing CSV:', err);
      }
    };
    reader.readAsText(file);
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('auth');
    router.push('/');
  };

  // Report selector component (used in upload, history, titles tabs)
  const ReportSelector = () => {
    if (vendorReports.length === 0) {
      return (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          No reports found for this vendor. Create a report first in the Reports tab.
        </div>
      );
    }
    return (
      <div className="mb-4">
        <label className="label">Report</label>
        <select
          value={selectedReport?.id || ''}
          onChange={(e) => handleReportSelect(e.target.value)}
          className="input-field"
        >
          {vendorReports.map((report) => (
            <option key={report.id} value={report.id}>
              {report.name}{report.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>
      </div>
    );
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="btn-secondary"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Alert messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {success}
          </div>
        )}

        {/* Company Logo Section */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-3">Company Logo</h2>
          <p className="text-sm text-gray-500 mb-3">This logo appears at the top of all vendor reports.</p>
          <div className="flex items-center gap-4">
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Company logo"
                className="h-14 object-contain rounded border border-gray-200 p-1"
              />
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleCompanyLogoUpload}
                className="input-field text-sm"
                disabled={companyLogoSaving}
              />
              {companyLogoSaving && <span className="text-xs text-gray-500 mt-1">Saving...</span>}
            </div>
            {companyLogo && (
              <button
                onClick={async () => {
                  try {
                    await saveAppSetting('company_logo', null);
                    setCompanyLogo(null);
                    setSuccess('Company logo removed');
                  } catch (err) {
                    setError('Failed to remove logo');
                  }
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Login Page Logo Section */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-3">Login Page Logo</h2>
          <p className="text-sm text-gray-500 mb-3">This logo appears on the login page. If not set, the report logo will be used.</p>
          <div className="flex items-center gap-4">
            {loginLogo && (
              <img
                src={loginLogo}
                alt="Login page logo"
                className="h-14 object-contain rounded border border-gray-200 p-1"
              />
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLoginLogoUpload}
                className="input-field text-sm"
                disabled={loginLogoSaving}
              />
              {loginLogoSaving && <span className="text-xs text-gray-500 mt-1">Saving...</span>}
            </div>
            {loginLogo && (
              <button
                onClick={async () => {
                  try {
                    await saveAppSetting('login_logo', null);
                    setLoginLogo(null);
                    setSuccess('Login page logo removed');
                  } catch (err) {
                    setError('Failed to remove login page logo');
                  }
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Admin Password Section */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-3">Admin Password</h2>
          <p className="text-sm text-gray-500 mb-3">Change your admin login password.</p>
          <form onSubmit={handleChangeAdminPassword} className="flex items-end gap-3">
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Confirm new password"
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="btn-primary"
            >
              {passwordSaving ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar: Vendor list */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Vendors</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setFormData({
                      name: '',
                      slug: '',
                      password: '',
                      monthly_budget: '',
                      show_budget: false,
                      hide_pdf_export: false,
                      hide_category_tab: false,
                      campaign_start: '',
                      campaign_end: '',
                      notes: '',
                    });
                  }}
                  className="btn-primary text-sm"
                >
                  + New
                </button>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {loading && vendors.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">Loading vendors...</div>
                ) : vendors.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No vendors yet</div>
                ) : (
                  vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      onClick={() => handleSelectVendor(vendor)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedVendor?.id === vendor.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{vendor.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{vendor.slug}</div>
                      {vendor.campaign_start && vendor.campaign_end && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(vendor.campaign_start).toLocaleDateString()} -{' '}
                          {new Date(vendor.campaign_end).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right side: Vendor details */}
          <div className="lg:col-span-2">
            {!selectedVendor ? (
              <div className="card flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <p className="text-lg">Select a vendor or create a new one</p>
                </div>
              </div>
            ) : (
              <div className="card">
                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b overflow-x-auto">
                  {['settings', 'reports', 'upload', 'history', 'titles', 'insights'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`px-4 py-2 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        selectedTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab === 'settings' && 'Settings'}
                      {tab === 'reports' && 'Reports'}
                      {tab === 'upload' && 'Upload Data'}
                      {tab === 'history' && 'Upload History'}
                      {tab === 'titles' && 'Title Mapping'}
                      {tab === 'insights' && 'Key Insights'}
                    </button>
                  ))}
                </div>

                {/* Settings Tab */}
                {selectedTab === 'settings' && (
                  <form onSubmit={handleSaveVendor} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={handleNameChange}
                          className="input-field"
                          placeholder="e.g., Coloplast"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Slug *</label>
                        <input
                          type="text"
                          value={formData.slug}
                          readOnly
                          className="input-field bg-gray-100"
                          placeholder="auto-generated"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Password *</label>
                        <input
                          type="text"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              password: e.target.value,
                            }))
                          }
                          className="input-field"
                          placeholder="Vendor access password"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Monthly Budget</label>
                        <input
                          type="number"
                          value={formData.monthly_budget}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              monthly_budget: e.target.value,
                            }))
                          }
                          className="input-field"
                          placeholder="e.g., 5000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Campaign Start</label>
                        <input
                          type="date"
                          value={formData.campaign_start}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              campaign_start: e.target.value,
                            }))
                          }
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label">Campaign End</label>
                        <input
                          type="date"
                          value={formData.campaign_end}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              campaign_end: e.target.value,
                            }))
                          }
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.show_budget}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                show_budget: e.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-medium">Show Budget on Dashboard</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.hide_pdf_export}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                hide_pdf_export: e.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-medium">Hide Export to PDF</span>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.hide_category_tab}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                hide_category_tab: e.target.checked,
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-medium">Hide Category Share Tab</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="label">Vendor Logo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleVendorLogoUpload}
                        className="input-field"
                      />
                      {formData.logo_url && (
                        <div className="mt-2 flex items-center gap-3">
                          <img
                            src={formData.logo_url}
                            alt="Vendor logo"
                            className="h-12 object-contain rounded border border-gray-200 p-1"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, logo_url: null }))}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        className="input-field"
                        rows={3}
                        placeholder="Internal notes about this vendor"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(true);
                          setVendorToDelete(selectedVendor);
                        }}
                        className="btn-danger"
                      >
                        Delete Vendor
                      </button>
                    </div>
                  </form>
                )}

                {/* Reports Tab */}
                {selectedTab === 'reports' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-500">
                        Each report has its own product name, category, data uploads, and title mappings.
                      </p>
                      <button
                        onClick={() => {
                          setEditingReport(null);
                          setReportFormData({ name: '', product_name: '', category_name: '', is_default: vendorReports.length === 0 });
                          setShowCreateReportModal(true);
                        }}
                        className="btn-primary text-sm"
                      >
                        + New Report
                      </button>
                    </div>

                    {vendorReports.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No reports yet. Create your first report.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {vendorReports.map((report) => (
                          <div
                            key={report.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">{report.name}</span>
                                  {report.is_default && (
                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                      Default
                                    </span>
                                  )}
                                </div>
                                {report.product_name && (
                                  <div className="text-sm text-gray-600 mt-1">Product: {report.product_name}</div>
                                )}
                                {report.category_name && (
                                  <div className="text-sm text-gray-600">Category: {report.category_name}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {!report.is_default && (
                                  <button
                                    onClick={() => handleSetDefault(report.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                    disabled={loading}
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingReport(report);
                                    setReportFormData({
                                      name: report.name,
                                      product_name: report.product_name || '',
                                      category_name: report.category_name || '',
                                      is_default: report.is_default,
                                    });
                                    setShowCreateReportModal(true);
                                  }}
                                  className="text-xs text-gray-600 hover:text-gray-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setReportToDelete(report);
                                    setShowDeleteReportConfirm(true);
                                  }}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Upload Tab */}
                {selectedTab === 'upload' && (
                  <div>
                    <ReportSelector />
                    {selectedReport && (
                      <form onSubmit={handleCSVUpload} className="space-y-6">
                        <div>
                          <label className="label">Product Data CSV</label>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => handleCSVFileChange(e, true)}
                            className="input-field"
                          />
                          {productCSVFile && (
                            <div className="mt-2 text-sm text-gray-600">
                              Selected: {productCSVFile.name}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="label">Category Data CSV</label>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => handleCSVFileChange(e, false)}
                            className="input-field"
                          />
                          {categoryCSVFile && (
                            <div className="mt-2 text-sm text-gray-600">
                              Selected: {categoryCSVFile.name}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="label">Customer Data CSV</label>
                          <p className="text-xs text-gray-500 mb-1">
                            One row per customer per day with binary flags. Columns: <code className="bg-gray-100 px-1 rounded">Day</code>, <code className="bg-gray-100 px-1 rounded">Customer ID</code>, <code className="bg-gray-100 px-1 rounded">New customers</code>, <code className="bg-gray-100 px-1 rounded">Returning customers</code>, <code className="bg-gray-100 px-1 rounded">Day (previous_year)</code>, <code className="bg-gray-100 px-1 rounded">New customers (previous_year)</code>, <code className="bg-gray-100 px-1 rounded">Returning customers (previous_year)</code>
                          </p>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCustomerCSVFile(file);
                            }}
                            className="input-field"
                          />
                          {customerCSVFile && (
                            <div className="mt-2 text-sm text-gray-600">
                              Selected: {customerCSVFile.name}
                            </div>
                          )}
                        </div>

                        {csvPreview && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-sm font-semibold text-blue-900 mb-2">
                              Preview: {csvPreview.type === 'product' ? 'Product' : 'Category'} CSV
                            </div>
                            <div className="text-sm text-blue-800">
                              <div>Months: {csvPreview.months}</div>
                              <div>Total Rows: {csvPreview.rows}</div>
                              <div>Date Range: {csvPreview.dateRange}</div>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={uploading || (!productCSVFile && !categoryCSVFile && !customerCSVFile)}
                          className="btn-primary"
                        >
                          {uploading ? 'Uploading...' : 'Upload & Process Files'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* History Tab */}
                {selectedTab === 'history' && (
                  <div>
                    <ReportSelector />
                    {selectedReport && (
                      <>
                        {uploadHistory.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No uploads yet for this report
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                                  <th className="px-4 py-2 text-left font-semibold">File Name</th>
                                  <th className="px-4 py-2 text-left font-semibold">Rows</th>
                                  <th className="px-4 py-2 text-left font-semibold">Date Range</th>
                                  <th className="px-4 py-2 text-left font-semibold">Uploaded</th>
                                </tr>
                              </thead>
                              <tbody>
                                {uploadHistory.map((record, idx) => (
                                  <tr key={idx} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                        record.file_type === 'product'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {record.file_type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">{record.file_name}</td>
                                    <td className="px-4 py-2 text-gray-700">{record.row_count}</td>
                                    <td className="px-4 py-2 text-gray-700">{record.date_range}</td>
                                    <td className="px-4 py-2 text-gray-600">
                                      {new Date(record.uploaded_at).toLocaleDateString()} at{' '}
                                      {new Date(record.uploaded_at).toLocaleTimeString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Title Mapping Tab */}
                {selectedTab === 'titles' && (
                  <div>
                    <ReportSelector />
                    {selectedReport && (
                      <>
                        <p className="text-sm text-gray-500 mb-4">
                          Map each SKU to its current product and variant title. These titles override whatever was in the CSV at time of sale.
                        </p>

                        {/* Existing mappings */}
                        {editingMappings.length > 0 && (
                          <div className="overflow-x-auto mb-6">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="px-3 py-2 text-left font-semibold">SKU</th>
                                  <th className="px-3 py-2 text-left font-semibold">Product Title</th>
                                  <th className="px-3 py-2 text-left font-semibold">Variant Title</th>
                                  <th className="px-3 py-2 text-left font-semibold w-20"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {editingMappings.map((mapping, idx) => (
                                  <tr key={mapping.sku} className="border-b">
                                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{mapping.sku}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={mapping.product_title}
                                        onChange={(e) => {
                                          const updated = [...editingMappings];
                                          updated[idx] = { ...updated[idx], product_title: e.target.value };
                                          setEditingMappings(updated);
                                        }}
                                        className="input-field text-sm"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={mapping.variant_title || ''}
                                        onChange={(e) => {
                                          const updated = [...editingMappings];
                                          updated[idx] = { ...updated[idx], variant_title: e.target.value };
                                          setEditingMappings(updated);
                                        }}
                                        className="input-field text-sm"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={async () => {
                                          try {
                                            await deleteSkuTitleMapping(selectedReport.id, mapping.sku);
                                            setSuccess(`Removed mapping for ${mapping.sku}`);
                                            await loadTitleMappings(selectedReport.id);
                                          } catch (err) {
                                            setError('Failed to remove mapping');
                                          }
                                        }}
                                        className="text-xs text-red-600 hover:text-red-800"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  await saveSkuTitleMap(selectedReport.id, editingMappings);
                                  setSuccess('Title mappings saved');
                                  await loadTitleMappings(selectedReport.id);
                                } catch (err) {
                                  setError('Failed to save mappings');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                              className="btn-primary mt-3"
                            >
                              {loading ? 'Saving...' : 'Save All Changes'}
                            </button>
                          </div>
                        )}

                        {/* Upload CSV mapping */}
                        <h3 className="text-md font-semibold mb-2 mt-4">Upload Title Mapping CSV</h3>
                        <p className="text-xs text-gray-500 mb-3">
                          CSV must have columns: <code className="bg-gray-100 px-1 rounded">sku</code>, <code className="bg-gray-100 px-1 rounded">product_title</code>, and optionally <code className="bg-gray-100 px-1 rounded">variant_title</code>.
                        </p>
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <input
                              type="file"
                              accept=".csv"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                  try {
                                    const Papa = (await import('papaparse')).default;
                                    const parsed = Papa.parse(ev.target.result, {
                                      header: true,
                                      skipEmptyLines: true,
                                    });
                                    const cols = parsed.meta.fields || [];
                                    if (!cols.includes('sku') || !cols.includes('product_title')) {
                                      setError('CSV must have "sku" and "product_title" columns');
                                      return;
                                    }
                                    const mappings = parsed.data
                                      .filter((row) => row.sku && row.product_title)
                                      .map((row) => ({
                                        sku: row.sku.trim(),
                                        product_title: row.product_title.trim(),
                                        variant_title: (row.variant_title || '').trim() || null,
                                      }));
                                    if (mappings.length === 0) {
                                      setError('No valid rows found in CSV');
                                      return;
                                    }
                                    setLoading(true);
                                    await saveSkuTitleMap(selectedReport.id, mappings);
                                    setSuccess(`Imported ${mappings.length} title mapping(s) from CSV`);
                                    await loadTitleMappings(selectedReport.id);
                                    e.target.value = '';
                                  } catch (err) {
                                    setError('Failed to process title mapping CSV: ' + err.message);
                                  } finally {
                                    setLoading(false);
                                  }
                                };
                                reader.readAsText(file);
                              }}
                              className="input-field text-sm"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Key Insights Tab */}
                {selectedTab === 'insights' && (
                  <div>
                    <ReportSelector />
                    {selectedReport && (
                      <>
                        <p className="text-sm text-gray-500 mb-4">
                          Customize the Key Insights text for each section of the report. Leave the text empty to use auto-generated insights, or toggle to hide insights entirely.
                        </p>

                        {[
                          { key: 'executive', label: 'Executive Summary' },
                          { key: 'yoy', label: 'Year-over-Year' },
                          { key: 'mom', label: 'Month-over-Month' },
                          { key: 'campaign', label: 'Campaign Period' },
                          { key: 'category', label: 'Category Share' },
                        ].map(({ key, label }) => (
                          <div key={key} className="card mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-md font-semibold text-gray-900">{label}</h3>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-sm text-gray-500">
                                  {insightsEditing[key]?.hidden ? 'Hidden' : 'Visible'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInsightsEditing((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], hidden: !prev[key].hidden },
                                    }));
                                  }}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    insightsEditing[key]?.hidden ? 'bg-gray-300' : 'bg-blue-600'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      insightsEditing[key]?.hidden ? 'translate-x-1' : 'translate-x-6'
                                    }`}
                                  />
                                </button>
                              </label>
                            </div>
                            {!insightsEditing[key]?.hidden && (
                              <div>
                                <textarea
                                  value={insightsEditing[key]?.text || ''}
                                  onChange={(e) => {
                                    setInsightsEditing((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], text: e.target.value },
                                    }));
                                  }}
                                  placeholder="Leave empty to use auto-generated insights..."
                                  rows={3}
                                  className="input-field text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                  {insightsEditing[key]?.text?.trim() ? 'Using custom text' : 'Using auto-generated insights'}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={handleSaveInsights}
                          disabled={insightsSaving}
                          className="btn-primary"
                        >
                          {insightsSaving ? 'Saving...' : 'Save Insights'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Vendor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Create New Vendor</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveVendor(e).then(() => {
                  if (!error) {
                    setShowCreateModal(false);
                  }
                });
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleNameChange}
                    className="input-field"
                    placeholder="e.g., Coloplast"
                    required
                  />
                </div>
                <div>
                  <label className="label">Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    readOnly
                    className="input-field bg-gray-100"
                    placeholder="auto-generated"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password *</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder="Vendor access password"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Campaign Start</label>
                  <input
                    type="date"
                    value={formData.campaign_start}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        campaign_start: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Campaign End</label>
                  <input
                    type="date"
                    value={formData.campaign_end}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        campaign_end: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Monthly Budget</label>
                  <input
                    type="number"
                    value={formData.monthly_budget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        monthly_budget: e.target.value,
                      }))
                    }
                    className="input-field"
                    placeholder="e.g., 5000"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.show_budget}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          show_budget: e.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Show Budget on Dashboard</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Vendor Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const base64 = await fileToBase64(file);
                      setFormData((prev) => ({ ...prev, logo_url: base64 }));
                    } catch (err) {
                      setError('Failed to read logo file');
                    }
                  }}
                  className="input-field"
                />
                {formData.logo_url && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={formData.logo_url}
                      alt="Vendor logo"
                      className="h-12 object-contain rounded border border-gray-200 p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, logo_url: null }))}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="input-field"
                  rows={3}
                  placeholder="Internal notes"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Creating...' : 'Create Vendor'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Report Modal */}
      {showCreateReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingReport ? 'Edit Report' : 'Create New Report'}</h2>
              <button
                onClick={() => {
                  setShowCreateReportModal(false);
                  setEditingReport(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveReport} className="p-6 space-y-4">
              <div>
                <label className="label">Report Name *</label>
                <input
                  type="text"
                  value={reportFormData.name}
                  onChange={(e) => setReportFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., SpeediCath Flex"
                  required
                />
              </div>

              <div>
                <label className="label">Product Name</label>
                <input
                  type="text"
                  value={reportFormData.product_name}
                  onChange={(e) => setReportFormData((prev) => ({ ...prev, product_name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., SpeediCath® Flex Hydrophilic Catheter"
                />
              </div>

              <div>
                <label className="label">Category Name</label>
                <input
                  type="text"
                  value={reportFormData.category_name}
                  onChange={(e) => setReportFormData((prev) => ({ ...prev, category_name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Urology"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reportFormData.is_default}
                    onChange={(e) => setReportFormData((prev) => ({ ...prev, is_default: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Set as default report</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving...' : editingReport ? 'Save Changes' : 'Create Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateReportModal(false);
                    setEditingReport(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Vendor Confirmation Modal */}
      {showDeleteConfirm && vendorToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Delete Vendor?</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{vendorToDelete.name}</strong>? This will also delete all reports and data. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteVendor}
                  disabled={loading}
                  className="btn-danger flex-1"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setVendorToDelete(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Report Confirmation Modal */}
      {showDeleteReportConfirm && reportToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Delete Report?</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{reportToDelete.name}</strong>? This will delete all data, uploads, and title mappings for this report. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteReport}
                  disabled={loading}
                  className="btn-danger flex-1"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteReportConfirm(false);
                    setReportToDelete(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
