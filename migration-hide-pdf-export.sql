-- Migration: Add hide_pdf_export column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS hide_pdf_export BOOLEAN DEFAULT false;
