'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  saveProductData,
  saveCategoryData,
  saveUploadHistory,
  getUploadHistory,
} from '@/lib/supabase';
import { parseProductCSV, parseCategoryCSV } from '@/lib/dataProcessing';

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

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    password: '',
    product_name: '',
    category_name: '',
    monthly_budget: '',
    show_budget: false,
    campaign_start: '',
    campaign_end: '',
    sku_map: '{}',
    notes: '',
  });

  // CSV upload states
  const [selectedTab, setSelectedTab] = useState('settings'); // settings | upload | history
  const [productCSVFile, setProductCSVFile] = useState(null);
  const [categoryCSVFile, setCategoryCSVFile] = useState(null);
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

  // Load vendors on mount
  useEffect(() => {
    if (isAuthorized) {
      loadVendors();
    }
  }, [isAuthorized]);

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

  const loadUploadHistory = async (vendorId) => {
    try {
      const history = await getUploadHistory(vendorId);
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

  // Handle vendor selection
  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setFormData(vendor);
    setSelectedTab('settings');
    setProductCSVFile(null);
    setCategoryCSVFile(null);
    setCSVPreview(null);
    loadUploadHistory(vendor.id);
  };

  // Handle create/edit form submission
  const handleSaveVendor = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // Validate required fields
      if (!formData.name || !formData.slug || !formData.password) {
        setError('Name, slug, and password are required');
        return;
      }

      // Validate JSON for sku_map
      try {
        JSON.parse(formData.sku_map || '{}');
      } catch {
        setError('SKU map must be valid JSON');
        return;
      }

      setLoading(true);

      // Sanitize data — convert empty strings to null for optional fields
      const sanitized = {
        ...formData,
        monthly_budget: formData.monthly_budget === '' ? null : parseFloat(formData.monthly_budget),
        campaign_start: formData.campaign_start || null,
        campaign_end: formData.campaign_end || null,
        product_name: formData.product_name || null,
        category_name: formData.category_name || null,
        notes: formData.notes || null,
        sku_map: formData.sku_map || '{}',
      };

      if (selectedVendor?.id) {
        // Update existing vendor
        await updateVendor(selectedVendor.id, sanitized);
        setSuccess('Vendor updated successfully');
      } else {
        // Create new vendor
        const newVendor = await createVendor(sanitized);
        setSuccess('Vendor created successfully');
        setFormData({
          name: '',
          slug: '',
          password: '',
          product_name: '',
          category_name: '',
          monthly_budget: '',
          show_budget: false,
          campaign_start: '',
          campaign_end: '',
          sku_map: '{}',
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
      await loadVendors();
    } catch (err) {
      setError('Failed to delete vendor');
      console.error(err);
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

    if (!productCSVFile && !categoryCSVFile) {
      setError('Please select at least one CSV file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      // Process product CSV if provided
      if (productCSVFile) {
        const productText = await productCSVFile.text();
        const skuMap = JSON.parse(formData.sku_map || '{}');
        const productData = parseProductCSV(productText, skuMap);

        // Save product data
        await saveProductData(selectedVendor.id, productData.monthlyData);

        // Save upload history
        if (productData.monthlyData && productData.monthlyData.length > 0) {
          const dateRange = productData.dateRange || 'Unknown';
          await saveUploadHistory(
            selectedVendor.id,
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

        // Save category data
        await saveCategoryData(selectedVendor.id, categoryData);

        // Save upload history
        if (categoryData && categoryData.length > 0) {
          await saveUploadHistory(
            selectedVendor.id,
            'category',
            categoryCSVFile.name,
            categoryData.length,
            new Date().toISOString().split('T')[0]
          );
        }
      }

      setSuccess('Files uploaded and processed successfully');
      setProductCSVFile(null);
      setCategoryCSVFile(null);
      setCSVPreview(null);
      await loadUploadHistory(selectedVendor.id);
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

    // Read and preview the CSV
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result;
        if (isProduct && productCSVFile) {
          const skuMap = JSON.parse(formData.sku_map || '{}');
          const parsed = parseProductCSV(csvText, skuMap);
          setCSVPreview({
            type: 'product',
            months: parsed.monthlyData?.length || 0,
            rows: csvText.split('\n').length - 1,
            dateRange: parsed.dateRange || 'N/A',
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
                      product_name: '',
                      category_name: '',
                      monthly_budget: '',
                      show_budget: false,
                      campaign_start: '',
                      campaign_end: '',
                      sku_map: '{}',
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
                      {vendor.last_upload_date && (
                        <div className="text-xs text-blue-600 mt-1">
                          Last upload: {new Date(vendor.last_upload_date).toLocaleDateString()}
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
                <div className="flex space-x-4 mb-6 border-b">
                  <button
                    onClick={() => setSelectedTab('settings')}
                    className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                      selectedTab === 'settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => setSelectedTab('upload')}
                    className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                      selectedTab === 'upload'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Upload Data
                  </button>
                  <button
                    onClick={() => setSelectedTab('history')}
                    className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                      selectedTab === 'history'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Upload History
                  </button>
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
                        <label className="label">Product Name</label>
                        <input
                          type="text"
                          value={formData.product_name}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              product_name: e.target.value,
                            }))
                          }
                          className="input-field"
                          placeholder="e.g., SpeediCath® Flex Hydrophilic Catheter"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Category Name</label>
                        <input
                          type="text"
                          value={formData.category_name}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              category_name: e.target.value,
                            }))
                          }
                          className="input-field"
                          placeholder="e.g., Urology"
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

                    <div>
                      <label className="label">Show Budget on Dashboard</label>
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
                    </div>

                    <div>
                      <label className="label">SKU Map (JSON)</label>
                      <textarea
                        value={formData.sku_map}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sku_map: e.target.value,
                          }))
                        }
                        className="input-field font-mono text-sm"
                        rows={4}
                        placeholder='{"COL 28920": "10 FR", "COL 28922": "12 FR"}'
                      />
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

                {/* Upload Tab */}
                {selectedTab === 'upload' && (
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
                      disabled={uploading || (!productCSVFile && !categoryCSVFile)}
                      className="btn-primary"
                    >
                      {uploading ? 'Uploading...' : 'Upload & Process Files'}
                    </button>
                  </form>
                )}

                {/* History Tab */}
                {selectedTab === 'history' && (
                  <div>
                    {uploadHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No uploads yet for this vendor
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
                  <label className="label">Product Name</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        product_name: e.target.value,
                      }))
                    }
                    className="input-field"
                    placeholder="e.g., SpeediCath® Flex"
                  />
                </div>
                <div>
                  <label className="label">Category Name</label>
                  <input
                    type="text"
                    value={formData.category_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category_name: e.target.value,
                      }))
                    }
                    className="input-field"
                    placeholder="e.g., Urology"
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
                <label className="label">SKU Map (JSON)</label>
                <textarea
                  value={formData.sku_map}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      sku_map: e.target.value,
                    }))
                  }
                  className="input-field font-mono text-sm"
                  rows={3}
                  placeholder='{"COL 28920": "10 FR", "COL 28922": "12 FR"}'
                />
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && vendorToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Delete Vendor?</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{vendorToDelete.name}</strong>? This action cannot be undone.
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
    </div>
  );
}
