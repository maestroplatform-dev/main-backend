-- Create teacher_section_reviews table
CREATE TABLE IF NOT EXISTS public.teacher_section_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('profile', 'pricing')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested')),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(teacher_id, section)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('success', 'error', 'warning', 'info')),
    section TEXT CHECK (section IN ('profile', 'pricing')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_section_reviews_teacher ON public.teacher_section_reviews(teacher_id);
CREATE INDEX IF NOT EXISTS idx_section_reviews_status ON public.teacher_section_reviews(status);
CREATE INDEX IF NOT EXISTS idx_notifications_teacher ON public.notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(teacher_id, is_read);

-- Add section_type enum if not exists
DO $$ BEGIN
    CREATE TYPE public.section_type AS ENUM ('profile', 'pricing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add review_status enum if not exists
DO $$ BEGIN
    CREATE TYPE public.review_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
