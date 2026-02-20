-- Migration: Add custom_insights column to reports table
-- Run this in Supabase SQL Editor before deploying code

-- Add custom_insights JSONB column to reports
-- Structure: { "executive": { "hidden": false, "text": "..." }, "yoy": { "hidden": true, "text": "" }, ... }
ALTER TABLE reports ADD COLUMN IF NOT EXISTS custom_insights JSONB DEFAULT '{}'::jsonb;
