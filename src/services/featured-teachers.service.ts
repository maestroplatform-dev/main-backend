import prisma from '../config/database'
import { AppError } from '../types'

export class FeaturedTeachersService {
  // Get all featured teachers with their details (public)
  static async getFeaturedTeachers() {
    const featuredTeachers = await prisma.$queryRaw<any[]>`
      SELECT 
        ft.id,
        ft.teacher_id,
        ft.display_order,
        t.name,
        t.profile_picture,
        t.tagline,
        t.bio,
        (
          SELECT array_agg(ti.instrument)
          FROM public.teacher_instruments ti
          WHERE ti.teacher_id = t.id
        ) as instruments,
        tf.class_formats
      FROM public.featured_teachers ft
      JOIN public.teachers t ON t.id = ft.teacher_id
      LEFT JOIN public.teacher_formats tf ON tf.teacher_id = t.id
      WHERE t.verified = true
      ORDER BY ft.display_order ASC
    `

    return featuredTeachers.map(teacher => ({
      id: teacher.teacher_id,
      name: teacher.name,
      profile_picture: teacher.profile_picture,
      tagline: teacher.tagline,
      instruments: teacher.instruments || [],
      classFormats: teacher.class_formats || [],
      display_order: teacher.display_order,
    }))
  }

  // Get featured teacher IDs (for admin)
  static async getFeaturedTeacherIds() {
    const featured = await prisma.$queryRaw<any[]>`
      SELECT teacher_id, display_order
      FROM public.featured_teachers
      ORDER BY display_order ASC
    `
    return featured
  }

  // Set featured teachers (replaces all existing)
  static async setFeaturedTeachers(teacherIds: string[], adminId: string) {
    if (teacherIds.length > 10) {
      throw new AppError(400, 'Maximum 10 featured teachers allowed', 'MAX_FEATURED_EXCEEDED')
    }

    // Verify all teacher IDs exist and are verified
    const teachers = await prisma.$queryRaw<any[]>`
      SELECT id FROM public.teachers 
      WHERE id = ANY(${teacherIds}::uuid[])
      AND verified = true
    `

    if (teachers.length !== teacherIds.length) {
      throw new AppError(400, 'Some teacher IDs are invalid or teachers are not verified', 'INVALID_TEACHERS')
    }

    // Delete all existing featured teachers
    await prisma.$executeRaw`DELETE FROM public.featured_teachers`

    // Insert new featured teachers with display order
    for (let i = 0; i < teacherIds.length; i++) {
      await prisma.$executeRaw`
        INSERT INTO public.featured_teachers (teacher_id, display_order, created_by)
        VALUES (${teacherIds[i]}::uuid, ${i + 1}, ${adminId}::uuid)
      `
    }

    return { success: true, count: teacherIds.length }
  }

  // Add a single teacher to featured
  static async addFeaturedTeacher(teacherId: string, adminId: string) {
    // Check current count
    const count = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM public.featured_teachers
    `

    if (parseInt(count[0].count) >= 10) {
      throw new AppError(400, 'Maximum 10 featured teachers allowed', 'MAX_FEATURED_EXCEEDED')
    }

    // Check if teacher is already featured
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM public.featured_teachers WHERE teacher_id = ${teacherId}::uuid
    `

    if (existing.length > 0) {
      throw new AppError(400, 'Teacher is already featured', 'ALREADY_FEATURED')
    }

    // Verify teacher exists and is verified
    const teacher = await prisma.$queryRaw<any[]>`
      SELECT id FROM public.teachers WHERE id = ${teacherId}::uuid AND verified = true
    `

    if (teacher.length === 0) {
      throw new AppError(404, 'Teacher not found or not verified', 'TEACHER_NOT_FOUND')
    }

    // Get max display order
    const maxOrder = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(MAX(display_order), 0) as max_order FROM public.featured_teachers
    `

    const newOrder = parseInt(maxOrder[0].max_order) + 1

    await prisma.$executeRaw`
      INSERT INTO public.featured_teachers (teacher_id, display_order, created_by)
      VALUES (${teacherId}::uuid, ${newOrder}, ${adminId}::uuid)
    `

    return { success: true, display_order: newOrder }
  }

  // Remove a teacher from featured
  static async removeFeaturedTeacher(teacherId: string) {
    const result = await prisma.$executeRaw`
      DELETE FROM public.featured_teachers WHERE teacher_id = ${teacherId}::uuid
    `

    if (result === 0) {
      throw new AppError(404, 'Teacher is not featured', 'NOT_FEATURED')
    }

    // Reorder remaining teachers
    await prisma.$executeRaw`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) as new_order
        FROM public.featured_teachers
      )
      UPDATE public.featured_teachers ft
      SET display_order = o.new_order, updated_at = NOW()
      FROM ordered o
      WHERE ft.id = o.id
    `

    return { success: true }
  }

  // Update display order
  static async updateDisplayOrder(teacherIds: string[]) {
    for (let i = 0; i < teacherIds.length; i++) {
      await prisma.$executeRaw`
        UPDATE public.featured_teachers
        SET display_order = ${i + 1}, updated_at = NOW()
        WHERE teacher_id = ${teacherIds[i]}::uuid
      `
    }

    return { success: true }
  }
}
