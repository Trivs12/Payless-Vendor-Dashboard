# Vendor Campaign Performance Dashboard

## What is This?

A **branded, password-protected analytics dashboard** that shows your vendors exactly how their campaign investment is driving real business results.

Upload Shopify data once, and the system automatically generates professional performance reports showing:
- Real sales growth from their campaigns
- New customers acquired
- Market share expansion in their category
- Year-over-year performance comparisons

Perfect for vendor meetings, quarterly reviews, and demonstrating the ROI of marketing partnerships.

---

## Key Features

✓ **Multi-Vendor Support** — Each vendor has their own password-protected view
✓ **Auto-Generated Insights** — AI-powered narrative analysis of campaign performance
✓ **Multiple Time Comparisons** — Year-over-Year, Month-over-Month, and Campaign Period analysis
✓ **Category Share Tracking** — See how vendors' sales grow relative to their entire category
✓ **PDF Export** — Professional reports ready for presentations and emails
✓ **Date Range Picker** — Vendors can customize what they're looking at
✓ **Co-Branded Design** — Your logo + vendor logo for professional appearance
✓ **Persistent Data** — Upload once, view anytime (no need to re-upload each month)

---

## Quick Setup (15 minutes)

Follow these three simple steps to get your dashboard live and ready for your first vendor.

### **Step 1: Create a Supabase Account** (5 minutes)

Supabase is where your data lives. It's free and easy to set up.

1. Go to **supabase.com** and click "Start Your Project"
2. Sign up with your email (or use Google/GitHub)
3. Click **"New Project"** and name it `vendor-dashboard`
4. Choose a strong database password and **save it somewhere safe** (you won't need it again, but keep it just in case)
5. Select your region (closest to you is fine)
6. Wait 1-2 minutes while Supabase sets up your database
7. Once ready, you'll see the Supabase dashboard

**Now, load the database schema:**

8. In the left sidebar, click **"SQL Editor"**
9. In your project folder, find the file called `supabase-schema.sql`
10. Copy the **entire contents** of that file
11. In the SQL Editor, click **"New Query"** and paste the code
12. Click the **"Run"** button (green play icon)
13. You should see a success message — the database is now set up!

**Copy your database credentials:**

14. Go to **Settings** (gear icon in left sidebar) → **API**
15. Find and copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
16. Find and copy your **anon public key** (a long string)
17. **Paste these into a text file** — you'll need them in Step 2

---

### **Step 2: Deploy to Vercel** (5 minutes)

Vercel is where your dashboard lives on the internet. Free to use, works great with Next.js.

**First, upload your code to GitHub:**

1. Go to **github.com** and sign up if you don't have an account
2. Click the **"+"** icon (top right) → **"New repository"**
3. Name it `vendor-dashboard`
4. Choose **"Public"** (Vercel needs this for the free tier)
5. Click **"Create repository"**
6. Follow GitHub's instructions to upload your project files
   - You can drag-and-drop files into the web interface, or use the command line if you're comfortable with it
   - Upload everything in the project folder

**Now deploy to Vercel:**

7. Go to **vercel.com** and click **"Sign Up"**
8. Click **"Continue with GitHub"** and connect your GitHub account
9. Click **"Add New Project"**
10. Find your `vendor-dashboard` repository and click **"Import"**
11. You'll see the "Environment Variables" section — **add these three items:**

    ```
    NEXT_PUBLIC_SUPABASE_URL
    (paste the Supabase URL you copied in Step 1)

    NEXT_PUBLIC_SUPABASE_ANON_KEY
    (paste the anon public key you copied in Step 1)

    ADMIN_PASSWORD
    (choose a strong password for admin access, like: MyV3nd0rD@sh2024!)
    ```

12. Click **"Deploy"**
13. Wait 1-2 minutes for deployment to finish
14. You'll see a green checkmark and a live URL (like `vendor-dashboard-xyz.vercel.app`)
15. **Click the URL to open your dashboard** — it's live!

---

### **Step 3: Create Your First Vendor** (5 minutes)

Now let's set up your first vendor so they can start using the dashboard.

1. Open your dashboard URL in your browser
2. Look for the **"Admin"** option in the top navigation
3. Enter your **ADMIN_PASSWORD** (the one you created in Step 2)
4. Click **"Create New Vendor"**
5. Fill in the vendor details. Here's what each field means:

   | Field | Example | Explanation |
   |-------|---------|-------------|
   | **Vendor Name** | Coloplast | How the vendor appears on the dashboard |
   | **Vendor Slug** | coloplast | Their login ID (lowercase, no spaces) |
   | **Vendor Password** | SpecialPass123 | Password they use to log in |
   | **Product Name** | SpeediCath® Flex Hydrophilic Catheter - Box of 30 | The specific product being promoted |
   | **Category Name** | Urology | The product category (e.g., Urology, Wound Care) |
   | **SKU Map** | `{"COL 28920": "10 FR", "COL 28922": "12 FR"}` | Maps Shopify SKUs to product variants (see below) |
   | **Monthly Budget** | 5000 | Ad spend or campaign budget (for context) |
   | **Campaign Start Date** | 2024-01-15 | When the campaign began |
   | **Campaign End Date** | 2024-06-30 | When the campaign ended |

6. **About the SKU Map:** This tells the dashboard which Shopify SKUs belong to this vendor's product. Format it like this:
   ```
   {"SKU_1": "Variant 1", "SKU_2": "Variant 2", "SKU_3": "Variant 3"}
   ```
   Find your SKUs in Shopify Admin → Products → click the product → look at the variant codes.

7. Click **"Create Vendor"** and you're done!

---

## How to Get Your Shopify CSV Files

The dashboard needs CSV exports from Shopify. Here's how to get them:

### **Step A: Export Product Sales Data**

1. Go to **Shopify Admin** → **Analytics** (or **Reports**)
2. Click **"Sales by product"** (or similar report)
3. Set the date range to your **campaign period** (when the campaign ran)
4. **Make sure to include** the comparison period (same dates from last year)
5. Click **"Export as CSV"** and save the file
6. In the vendor form, upload this as **"Product Data CSV"**

### **Step B: Export Category Sales Data**

1. Go to **Shopify Admin** → **Analytics** (or **Reports**)
2. Click **"Sales by day"** or **"Sales trends"**
3. Set the date range to your **full category** for the campaign year
4. Again, include the comparison year for Year-over-Year analysis
5. Click **"Export as CSV"** and save the file
6. In the vendor form, upload this as **"Category Data CSV"**

**Need help?** Contact your Shopify support team — they can walk you through exporting these reports.

---

## How Vendors Access Their Dashboard

Here's what you'll tell your vendors:

1. **Share the dashboard URL** with them (the one Vercel gave you, like `vendor-dashboard-xyz.vercel.app`)
2. They click on **"Vendor Login"** (or similar button)
3. They enter their **Dashboard ID** (the slug you created, e.g., `coloplast`)
4. They enter their **password** (the one you set up for them)
5. They're in! They can now:
   - View their performance dashboard
   - Switch between tabs (Overview, Insights, Category Share, etc.)
   - Use the **date picker** to zoom in on specific time periods
   - Click **"Download PDF"** to get a professional report for meetings

---

## Managing Vendors

### **Adding More Vendors**

Repeat **Step 3** above for each new vendor campaign. Each one gets:
- Their own login (slug + password)
- Their own dashboard
- Their own data (completely private)

### **Updating Vendor Data**

As time goes on, you'll get new sales data from Shopify. Here's how to update:

1. Log into **Admin** mode with your admin password
2. Select the vendor you want to update
3. Click the **"Upload Data"** tab
4. Upload the **latest Shopify CSV files**
5. The dashboard automatically recalculates and shows the new numbers
6. The vendor sees updated insights the next time they log in

### **Modifying Vendor Details**

Need to change a vendor's password, dates, or SKU map? Contact your developer — they can update these in the admin panel or the Supabase dashboard.

---

## Custom Domain (Optional, but Recommended)

Right now your dashboard lives at a long URL like `vendor-dashboard-xyz.vercel.app`. You can use your own domain instead.

1. Go to **vercel.com** and log in
2. Click your **vendor-dashboard** project
3. Go to **Settings** → **Domains**
4. Enter your custom domain (like `analytics.yourbrand.com`)
5. Follow Vercel's instructions to point your domain to them (you'll update DNS settings with your domain registrar)

This takes 5-10 minutes and makes the dashboard feel more professional.

---

## Troubleshooting

### **Dashboard won't load**
- Check that you pasted the Supabase URL and keys correctly in Vercel environment variables
- Wait a few minutes and refresh — Vercel sometimes needs time to update

### **Vendor can't log in**
- Double-check their slug and password (case-sensitive!)
- Make sure you created the vendor in admin panel first

### **Charts aren't showing**
- Make sure you uploaded both the Product Data CSV and Category Data CSV
- Check that the CSVs have the correct format from Shopify (not edited in Excel)

### **Data looks wrong**
- Verify the SKU Map in the vendor setup is correct
- Make sure the date ranges overlap with your Shopify export dates

**Still stuck?** Contact your developer — they can check the logs and debug quickly.

---

## Tech Stack (For Reference)

You don't need to know this, but here's what's running under the hood:

- **Next.js 14** — The dashboard framework
- **React** — User interface
- **Supabase** — Database and authentication
- **Chart.js** — For all the charts and graphs
- **Tailwind CSS** — Styling and layout
- **Vercel** — Hosting and deployment

---

## Need Help?

- **Dashboard questions?** → Contact your developer
- **Shopify export questions?** → Contact Shopify support
- **Vendor login issues?** → Check that their slug and password are correct
- **Want to add a feature?** → Talk to your developer about customizations

---

## Summary

You now have a professional, vendor-facing analytics dashboard. Here's what you can do:

✓ Create unlimited vendor accounts
✓ Upload Shopify data and generate insights automatically
✓ Share branded performance reports
✓ Track campaign ROI across vendors
✓ Maintain data privacy (each vendor only sees their own data)

Congratulations — you're ready to impress your vendors with data! 🎉

---

*Last Updated: February 2025*
