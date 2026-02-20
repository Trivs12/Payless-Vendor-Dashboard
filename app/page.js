'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAppSetting } from '@/lib/supabase';

export default function LoginPage() {
  const [mode, setMode] = useState('vendor'); // 'vendor' or 'admin'
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function loadLogo() {
      try {
        const loginLogo = await getAppSetting('login_logo');
        if (loginLogo) {
          setCompanyLogo(loginLogo);
          return;
        }
        const logo = await getAppSetting('company_logo');
        if (logo) setCompanyLogo(logo);
      } catch (e) {
        // Silently fail - will show fallback
      }
    }
    loadLogo();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          slug: mode === 'vendor' ? slug.toLowerCase().trim() : undefined,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store auth token in sessionStorage
      sessionStorage.setItem('auth', JSON.stringify(data));

      if (mode === 'admin') {
        router.push('/admin');
      } else {
        router.push(`/dashboard/${data.slug}`);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          {companyLogo ? (
            <img src={companyLogo} alt="Company Logo" className="h-48 mx-auto mb-4 object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold mb-4 shadow-lg">
              CP
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Campaign Performance</h1>
          <p className="text-gray-500 mt-1">Vendor Analytics Dashboard</p>
        </div>

        {/* Login card */}
        <div className="card">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('vendor'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'vendor'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Vendor Access
            </button>
            <button
              onClick={() => { setMode('admin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'admin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {mode === 'vendor' && (
              <div>
                <label htmlFor="slug" className="label">Dashboard ID</label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., payless medical"
                  className="input-field"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                mode === 'admin' ? 'Access Admin Panel' : 'View Dashboard'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Payless Medical Analytics
        </p>
      </div>
    </div>
  );
}
