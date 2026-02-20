import { NextResponse } from 'next/server';
import { getVendorBySlug, getAppSetting } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { mode, slug, password } = await request.json();

    if (mode === 'admin') {
      // Check app_settings first (changeable from admin portal), fall back to env var
      const storedPassword = await getAppSetting('admin_password');
      const adminPassword = storedPassword || process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        return NextResponse.json(
          { error: 'Admin password not configured' },
          { status: 500 }
        );
      }
      if (password !== adminPassword) {
        return NextResponse.json(
          { error: 'Invalid admin password' },
          { status: 401 }
        );
      }
      return NextResponse.json({
        role: 'admin',
        authenticated: true,
      });
    }

    if (mode === 'vendor') {
      if (!slug) {
        return NextResponse.json(
          { error: 'Dashboard ID is required' },
          { status: 400 }
        );
      }

      const vendor = await getVendorBySlug(slug);
      if (!vendor) {
        return NextResponse.json(
          { error: 'Dashboard not found' },
          { status: 404 }
        );
      }

      if (vendor.password !== password) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        role: 'vendor',
        slug: vendor.slug,
        vendorId: vendor.id,
        vendorName: vendor.name,
        authenticated: true,
      });
    }

    return NextResponse.json(
      { error: 'Invalid login mode' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
