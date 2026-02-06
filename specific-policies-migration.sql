-- Add 'specific_policies' to the section_type enum
ALTER TYPE public.section_type ADD VALUE IF NOT EXISTS 'specific_policies';

-- Create the teacher_specific_policies table
CREATE TABLE IF NOT EXISTS public.teacher_specific_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL UNIQUE REFERENCES public.teachers(id) ON DELETE CASCADE,
  
  -- Rescheduling & cancellation limits (null = unlimited)
  reschedule_limit INT,
  cancellation_limit INT,
  advance_notice_hours INT NOT NULL DEFAULT 24,
  
  -- No-show threshold
  noshow_threshold_mins INT NOT NULL DEFAULT 10,
  
  -- Fee structure as JSON
  fee_structure JSON,
  
  -- Consent & acceptance
  media_consent BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_specific_policies_teacher ON public.teacher_specific_policies(teacher_id);
