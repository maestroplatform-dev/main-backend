-- Quiz Responses Migration
-- Run this SQL in Supabase SQL Editor

-- Create the quiz_responses table (stores all quiz submissions with contact info)
CREATE TABLE public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  instruments TEXT[] NOT NULL DEFAULT '{}',
  learning_mode TEXT NOT NULL DEFAULT 'both',
  pincode TEXT,
  city TEXT,
  budget_min INT,
  budget_max INT,
  learning_goals TEXT[] NOT NULL DEFAULT '{}',
  skill_level TEXT NOT NULL DEFAULT 'beginner',
  contacted BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_quiz_responses_created ON public.quiz_responses(created_at DESC);
CREATE INDEX idx_quiz_responses_contacted ON public.quiz_responses(contacted);
CREATE INDEX idx_quiz_responses_phone ON public.quiz_responses(phone);

-- Enable RLS
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
