import { z } from 'zod'

// Auth validation schemas
export const registerSchema = z.object({
  role: z.enum(['student', 'teacher']).default('student'),
})

// Teacher onboarding schema
export const teacherOnboardingSchema = z.object({
  bio: z.string().min(50, 'Bio must be at least 50 characters').max(1000),
  instruments: z.array(z.string()).min(1, 'At least one instrument required'),
  genres: z.array(z.string()).min(1, 'At least one genre required'),
  experience_years: z.number().int().min(0).max(70),
  hourly_rate: z.number().positive().optional(),
  location: z.string().min(2),
  timezone: z.string(), // e.g., "America/New_York"
})

// Teacher profile update schema
export const teacherProfileUpdateSchema = z.object({
  bio: z.string().min(50).max(1000).optional(),
  instruments: z.array(z.string()).min(1).optional(),
  genres: z.array(z.string()).min(1).optional(),
  experience_years: z.number().int().min(0).max(70).optional(),
  hourly_rate: z.number().positive().optional(),
  location: z.string().min(2).optional(),
  timezone: z.string().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>
export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateSchema>
