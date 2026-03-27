-- Add UPI payout support to teacher_bank_details
-- Run this migration in your Supabase SQL editor

ALTER TABLE public.teacher_bank_details
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(10) NOT NULL DEFAULT 'BANK',
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);

ALTER TABLE public.teacher_bank_details
  ALTER COLUMN bank_name DROP NOT NULL,
  ALTER COLUMN account_holder_name DROP NOT NULL,
  ALTER COLUMN account_number DROP NOT NULL;

UPDATE public.teacher_bank_details
SET payout_method = 'UPI'
WHERE upi_id IS NOT NULL AND btrim(upi_id) <> '';

UPDATE public.teacher_bank_details
SET payout_method = 'BANK'
WHERE payout_method IS NULL OR payout_method NOT IN ('BANK', 'UPI');

ALTER TABLE public.teacher_bank_details
  DROP CONSTRAINT IF EXISTS teacher_bank_details_payout_method_check;

ALTER TABLE public.teacher_bank_details
  ADD CONSTRAINT teacher_bank_details_payout_method_check CHECK (
    (payout_method = 'BANK' AND bank_name IS NOT NULL AND account_holder_name IS NOT NULL AND account_number IS NOT NULL)
    OR
    (payout_method = 'UPI' AND upi_id IS NOT NULL)
  );
