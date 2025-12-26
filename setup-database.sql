-- Drop existing profiles table if it has auth.users reference
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.class_packages CASCADE;
DROP TABLE IF EXISTS public.purchased_packages CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.teacher_availability CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;

-- Now run: npx prisma db push
