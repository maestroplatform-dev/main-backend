-- Create indexes to fix slow queries causing 20-second timeouts

-- Index for GET /api/v1/bookings/teacher/pending-count
-- Speeds up: WHERE teacher_id = ? AND status = 'PENDING_APPROVAL'
CREATE INDEX IF NOT EXISTS idx_bookings_teacher_status 
ON public.bookings(teacher_id, status);

-- Index for GET /api/v1/bookings/teacher
-- Speeds up: WHERE teacher_id = ?
CREATE INDEX IF NOT EXISTS idx_bookings_teacher_id 
ON public.bookings(teacher_id);

-- Index for GET /api/v1/teachers/notifications/unread-count
-- Speeds up: WHERE teacher_id = ? AND is_read = false
CREATE INDEX IF NOT EXISTS idx_notifications_teacher_unread 
ON public.notifications(teacher_id, is_read);
