-- Support Tickets Migration
-- Run this SQL in Supabase SQL Editor

-- Create the enum for ticket status
CREATE TYPE public.support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create the support_tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_support_tickets_student ON public.support_tickets(student_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- Enable RLS (but allow service role full access)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
