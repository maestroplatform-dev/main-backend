-- Create teacher_bank_details table for storing teacher payout information
-- Run this migration in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.teacher_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL UNIQUE REFERENCES public.teachers(id) ON DELETE CASCADE,
    payout_method VARCHAR(10) NOT NULL DEFAULT 'BANK',
    bank_name VARCHAR(255),
    account_holder_name VARCHAR(255),
    account_number VARCHAR(50),
    upi_id VARCHAR(255),
    gst_number VARCHAR(20),
    ifsc_code VARCHAR(20),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teacher_bank_details
    DROP CONSTRAINT IF EXISTS teacher_bank_details_payout_method_check;

ALTER TABLE public.teacher_bank_details
    ADD CONSTRAINT teacher_bank_details_payout_method_check CHECK (
        (payout_method = 'BANK' AND bank_name IS NOT NULL AND account_holder_name IS NOT NULL AND account_number IS NOT NULL)
        OR
        (payout_method = 'UPI' AND upi_id IS NOT NULL)
    );

-- Add RLS policies
ALTER TABLE public.teacher_bank_details ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own bank details
CREATE POLICY "Teachers can view own bank details" ON public.teacher_bank_details
    FOR SELECT
    USING (auth.uid() = teacher_id);

-- Teachers can insert their own bank details
CREATE POLICY "Teachers can insert own bank details" ON public.teacher_bank_details
    FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

-- Teachers can update their own bank details
CREATE POLICY "Teachers can update own bank details" ON public.teacher_bank_details
    FOR UPDATE
    USING (auth.uid() = teacher_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_bank_details_teacher_id ON public.teacher_bank_details(teacher_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teacher_bank_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teacher_bank_details_timestamp
    BEFORE UPDATE ON public.teacher_bank_details
    FOR EACH ROW
    EXECUTE FUNCTION update_teacher_bank_details_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.teacher_bank_details TO authenticated;
GRANT ALL ON public.teacher_bank_details TO service_role;
