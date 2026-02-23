-- Migration: Make package_id optional in purchased_packages
-- This allows students to purchase sessions without a pre-created class package.
-- The new cart flow uses volume-based pricing (multiplier on teacher tier price)
-- instead of relying on class_packages records.

ALTER TABLE public.purchased_packages
  ALTER COLUMN package_id DROP NOT NULL;
