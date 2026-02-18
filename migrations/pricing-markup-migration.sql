-- Migration: Add admin-configurable pricing markup columns to teachers table
-- These columns allow per-teacher override of the standard pricing formula.
-- NULL = use default values (20% single, 15% 10-session, 10% 20-session, 5% 30-session)

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS custom_markup_pct_single  DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS custom_markup_pct_10      DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS custom_markup_pct_20      DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS custom_markup_pct_30      DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS custom_rounding_single    INT,
  ADD COLUMN IF NOT EXISTS custom_rounding_package   INT;

-- Add comments for documentation
COMMENT ON COLUMN public.teachers.custom_markup_pct_single IS 'Admin override: markup % for single/1:1 sessions. NULL = default 20%';
COMMENT ON COLUMN public.teachers.custom_markup_pct_10     IS 'Admin override: markup % for 10-session packages. NULL = default 15%';
COMMENT ON COLUMN public.teachers.custom_markup_pct_20     IS 'Admin override: markup % for 20-session packages. NULL = default 10%';
COMMENT ON COLUMN public.teachers.custom_markup_pct_30     IS 'Admin override: markup % for 30-session packages. NULL = default 5%';
COMMENT ON COLUMN public.teachers.custom_rounding_single   IS 'Admin override: rounding multiple for 1:1 prices. NULL = default 25';
COMMENT ON COLUMN public.teachers.custom_rounding_package  IS 'Admin override: rounding multiple for package prices. NULL = default 50';
