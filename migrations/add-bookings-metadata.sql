-- Add metadata column to bookings table for tracking reminder state etc.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
