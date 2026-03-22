DO $$ BEGIN
  CREATE TYPE public.booking_initiated_by AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_mark AS ENUM ('PENDING', 'PRESENT', 'ABSENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_final_status AS ENUM ('PENDING', 'PRESENT', 'ABSENT', 'DISPUTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS initiated_by public.booking_initiated_by NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN IF NOT EXISTS teacher_attendance public.attendance_mark NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS student_attendance public.attendance_mark NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS teacher_attendance_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_attendance_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_final_status public.attendance_final_status NOT NULL DEFAULT 'PENDING';

-- Backfill booking initiator heuristics for existing data.
UPDATE public.bookings
SET initiated_by = CASE
  WHEN is_demo = true THEN 'STUDENT'::public.booking_initiated_by
  WHEN status = 'PENDING_APPROVAL'::public.booking_status AND meeting_link IS NULL THEN 'STUDENT'::public.booking_initiated_by
  WHEN status = 'PENDING_APPROVAL'::public.booking_status AND meeting_link IS NOT NULL THEN 'TEACHER'::public.booking_initiated_by
  WHEN status = 'SCHEDULED'::public.booking_status AND meeting_link IS NOT NULL THEN 'SYSTEM'::public.booking_initiated_by
  ELSE initiated_by
END
WHERE initiated_by = 'STUDENT'::public.booking_initiated_by;

-- Backfill attendance fields from legacy booking status.
UPDATE public.bookings
SET
  teacher_attendance = CASE
    WHEN status = 'COMPLETED'::public.booking_status THEN 'PRESENT'::public.attendance_mark
    WHEN status = 'ABSENT'::public.booking_status THEN 'ABSENT'::public.attendance_mark
    ELSE teacher_attendance
  END,
  student_attendance = CASE
    WHEN status = 'COMPLETED'::public.booking_status THEN 'PRESENT'::public.attendance_mark
    WHEN status = 'ABSENT'::public.booking_status THEN 'ABSENT'::public.attendance_mark
    ELSE student_attendance
  END,
  attendance_final_status = CASE
    WHEN status = 'COMPLETED'::public.booking_status THEN 'PRESENT'::public.attendance_final_status
    WHEN status = 'ABSENT'::public.booking_status THEN 'ABSENT'::public.attendance_final_status
    ELSE attendance_final_status
  END,
  attendance_finalized_at = CASE
    WHEN status IN ('COMPLETED'::public.booking_status, 'ABSENT'::public.booking_status)
    THEN COALESCE(attendance_finalized_at, updated_at, now())
    ELSE attendance_finalized_at
  END;