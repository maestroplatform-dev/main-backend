-- Add WhatsApp verification fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;

-- OTP challenge table
CREATE TABLE IF NOT EXISTS public.whatsapp_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_user_created
  ON public.whatsapp_otp_challenges(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone_created
  ON public.whatsapp_otp_challenges(whatsapp_number, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_expires
  ON public.whatsapp_otp_challenges(expires_at);
