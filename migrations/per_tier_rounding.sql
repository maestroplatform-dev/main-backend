-- Migration: Expand rounding from 2 fields (single, package) to 4 per-tier fields (single, 10, 20, 30)
-- This replaces custom_rounding_package with custom_rounding_10, custom_rounding_20, custom_rounding_30

-- Add new per-tier rounding columns
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS custom_rounding_10 INT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS custom_rounding_20 INT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS custom_rounding_30 INT;

-- Migrate existing custom_rounding_package values to all three new columns
UPDATE teachers
SET
  custom_rounding_10 = custom_rounding_package,
  custom_rounding_20 = custom_rounding_package,
  custom_rounding_30 = custom_rounding_package
WHERE custom_rounding_package IS NOT NULL;

-- Drop the old column
ALTER TABLE teachers DROP COLUMN IF EXISTS custom_rounding_package;
