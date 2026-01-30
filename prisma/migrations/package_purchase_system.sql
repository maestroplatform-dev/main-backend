-- Package Purchase System Migration
-- Run this in Supabase SQL Editor

-- Step 1: Create new enums
DO $$ 
BEGIN
    -- payment_option_type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_option_type') THEN
        CREATE TYPE public.payment_option_type AS ENUM ('FLEXIBLE', 'UPFRONT');
    END IF;
    
    -- purchase_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_status') THEN
        CREATE TYPE public.purchase_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'COMPLETED', 'CANCELLED', 'FAILED');
    END IF;
    
    -- payment_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
    END IF;
END $$;

-- Step 2: Alter purchased_packages table to add new columns
-- First, backup existing data and handle migration

-- Add new columns to purchased_packages
ALTER TABLE public.purchased_packages
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS classes_completed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_package_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_session DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_option public.payment_option_type DEFAULT 'FLEXIBLE',
ADD COLUMN IF NOT EXISTS sessions_paid INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_session_date DATE;

-- Drop old columns if they exist
ALTER TABLE public.purchased_packages DROP COLUMN IF EXISTS payment_id;

-- Create temporary column for status migration
ALTER TABLE public.purchased_packages 
ADD COLUMN IF NOT EXISTS status_new public.purchase_status DEFAULT 'PENDING';

-- Migrate existing status values
UPDATE public.purchased_packages 
SET status_new = CASE 
    WHEN status = 'active' THEN 'ACTIVE'::public.purchase_status
    WHEN status = 'expired' THEN 'EXPIRED'::public.purchase_status
    WHEN status = 'completed' THEN 'COMPLETED'::public.purchase_status
    WHEN status = 'cancelled' THEN 'CANCELLED'::public.purchase_status
    ELSE 'ACTIVE'::public.purchase_status
END
WHERE status_new IS NULL OR status IS NOT NULL;

-- Drop old status column and rename new one
ALTER TABLE public.purchased_packages DROP COLUMN IF EXISTS status;
ALTER TABLE public.purchased_packages RENAME COLUMN status_new TO status;

-- Update teacher_id from class_packages for existing records
UPDATE public.purchased_packages pp
SET teacher_id = cp.teacher_id
FROM public.class_packages cp
WHERE pp.package_id = cp.id AND pp.teacher_id IS NULL;

-- Make teacher_id NOT NULL after migration (only if all rows have values)
-- ALTER TABLE public.purchased_packages ALTER COLUMN teacher_id SET NOT NULL;

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_purchased_packages_teacher ON public.purchased_packages(teacher_id);
CREATE INDEX IF NOT EXISTS idx_purchased_packages_status ON public.purchased_packages(status);

-- Step 3: Create purchase_payments table
CREATE TABLE IF NOT EXISTS public.purchase_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchased_package_id UUID NOT NULL REFERENCES public.purchased_packages(id) ON DELETE CASCADE,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    sessions_covered INT NOT NULL,
    
    status public.payment_status DEFAULT 'PENDING',
    payment_method TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    metadata JSONB
);

-- Add indexes for purchase_payments
CREATE INDEX IF NOT EXISTS idx_purchase_payments_package ON public.purchase_payments(purchased_package_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_razorpay ON public.purchase_payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_status ON public.purchase_payments(status);

-- Step 4: Create package_scheduled_sessions table
CREATE TABLE IF NOT EXISTS public.package_scheduled_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchased_package_id UUID NOT NULL REFERENCES public.purchased_packages(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    
    day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TEXT NOT NULL,
    duration_minutes INT DEFAULT 30,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for package_scheduled_sessions
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_package ON public.package_scheduled_sessions(purchased_package_id);

-- Step 5: Enable Row Level Security
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS Policies for purchase_payments

-- Students can view their own payments
CREATE POLICY "Students can view own payments" ON public.purchase_payments
FOR SELECT
USING (
    purchased_package_id IN (
        SELECT id FROM public.purchased_packages 
        WHERE student_id = auth.uid()
    )
);

-- Teachers can view payments for their packages
CREATE POLICY "Teachers can view package payments" ON public.purchase_payments
FOR SELECT
USING (
    purchased_package_id IN (
        SELECT id FROM public.purchased_packages 
        WHERE teacher_id = auth.uid()
    )
);

-- System can insert/update payments (via service role)
CREATE POLICY "Service can manage payments" ON public.purchase_payments
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 7: Create RLS Policies for package_scheduled_sessions

-- Students can view their own scheduled sessions
CREATE POLICY "Students can view own scheduled sessions" ON public.package_scheduled_sessions
FOR SELECT
USING (
    purchased_package_id IN (
        SELECT id FROM public.purchased_packages 
        WHERE student_id = auth.uid()
    )
);

-- Teachers can view scheduled sessions for their packages
CREATE POLICY "Teachers can view scheduled sessions" ON public.package_scheduled_sessions
FOR SELECT
USING (teacher_id = auth.uid());

-- Service can manage scheduled sessions
CREATE POLICY "Service can manage scheduled sessions" ON public.package_scheduled_sessions
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 8: Grant permissions
GRANT ALL ON public.purchase_payments TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;
GRANT ALL ON public.package_scheduled_sessions TO authenticated;
GRANT ALL ON public.package_scheduled_sessions TO service_role;

-- Done!
-- After running this migration, update your .env with Razorpay credentials:
-- RAZORPAY_KEY_ID=your_key_id
-- RAZORPAY_KEY_SECRET=your_key_secret
