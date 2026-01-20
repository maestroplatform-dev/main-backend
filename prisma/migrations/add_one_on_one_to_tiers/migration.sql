-- Add one_on_one_price_inr to teacher_instrument_tiers
ALTER TABLE public.teacher_instrument_tiers
ADD COLUMN IF NOT EXISTS one_on_one_price_inr DECIMAL(10, 2);

-- Drop one_on_one_price_inr from teacher_instruments
ALTER TABLE public.teacher_instruments
DROP COLUMN IF EXISTS one_on_one_price_inr;
