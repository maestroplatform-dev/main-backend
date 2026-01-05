import { z } from 'zod'

// Auth validation schemas
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  role: z.enum(['student', 'teacher', 'admin']).default('student'),
})

// Comprehensive Teacher Onboarding Schema (all steps in one)
export const teacherCompleteOnboardingSchema = z.object({
  // Step 2: Basic Information
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  date_of_birth: z.string().datetime(),
  languages: z.array(z.string()).min(1, 'At least one language required'),
  music_experience_years: z.number().int().min(0).max(70),
  teaching_experience_years: z.number().int().min(0).max(70),
  performance_experience_years: z.number().int().min(0).max(70),
  current_city: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  demo_session_available: z.boolean(),
  media_consent: z.boolean(),

  // Step 3: Engagement Preferences
  engagement_type: z.enum(['Teaching', 'Performance', 'Both']),
  collaborative_projects: z.array(z.string()).default([]),
  collaborative_other: z.string().optional(),

  // Step 3: Teaching Formats
  class_formats: z.array(z.string()).min(1),
  class_formats_other: z.string().optional(),
  exam_training: z.array(z.string()).default([]),
  exam_training_other: z.string().optional(),
  additional_formats: z.array(z.string()).default([]),
  additional_formats_other: z.string().optional(),
  learner_groups: z.array(z.string()).min(1),
  learner_groups_other: z.string().optional(),
  other_contribution: z.string().optional(),

  // Step 4: Instruments & Pricing
  instruments: z
    .array(
      z.object({
        instrument: z.string().min(1),
        teach_or_perform: z.enum(['Teach', 'Perform']),
        base_price: z.number().positive().optional(),
      })
    )
    .min(1),
  open_to_international: z.boolean(),
  international_premium: z.number().nonnegative().optional(),
})

// Old schemas (kept for compatibility)
export const teacherOnboardingSchema = z.object({
  bio: z.string().min(50, 'Bio must be at least 50 characters').max(1000),
  instruments: z.array(z.string()).min(1, 'At least one instrument required'),
  genres: z.array(z.string()).min(1, 'At least one genre required'),
  experience_years: z.number().int().min(0).max(70),
  hourly_rate: z.number().positive().optional(),
  location: z.string().min(2),
  timezone: z.string(),
})

export const teacherProfileUpdateSchema = z.object({
  bio: z.string().min(50).max(1000).optional(),
  instruments: z.array(z.string()).min(1).optional(),
  genres: z.array(z.string()).min(1).optional(),
  experience_years: z.number().int().min(0).max(70).optional(),
  hourly_rate: z.number().positive().optional(),
  location: z.string().min(2).optional(),
  timezone: z.string().optional(),
})

// Admin Teacher Registration Schema (register on behalf of teacher)
export const adminRegisterTeacherSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Teacher name is required').max(120),
  // Step 2: Basic Information
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  date_of_birth: z.string().datetime(),
  languages: z.array(z.string()).min(1, 'At least one language required'),
  music_experience_years: z.number().int().min(0).max(70),
  teaching_experience_years: z.number().int().min(0).max(70),
  performance_experience_years: z.number().int().min(0).max(70),
  current_city: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  demo_session_available: z.boolean(),
  media_consent: z.boolean(),

  // Step 3: Engagement Preferences
  engagement_type: z.enum(['Teaching', 'Performance', 'Both']),
  collaborative_projects: z.array(z.string()).default([]),
  collaborative_other: z.string().optional(),

  // Step 3: Teaching Formats
  class_formats: z.array(z.string()).min(1),
  class_formats_other: z.string().optional(),
  exam_training: z.array(z.string()).default([]),
  exam_training_other: z.string().optional(),
  additional_formats: z.array(z.string()).default([]),
  additional_formats_other: z.string().optional(),
  learner_groups: z.array(z.string()).min(1),
  learner_groups_other: z.string().optional(),
  other_contribution: z.string().optional(),

  // Step 4: Instruments & Pricing
  instruments: z
    .array(
      z.object({
        instrument: z.string().min(1),
        teach_or_perform: z.enum(['Teach', 'Perform']),
        base_price: z.number().positive().optional(),
      })
    )
    .min(1),
  open_to_international: z.boolean(),
  international_premium: z.number().nonnegative().optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type TeacherCompleteOnboardingInput = z.infer<typeof teacherCompleteOnboardingSchema>
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>
export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateSchema>
export type AdminRegisterTeacherInput = z.infer<typeof adminRegisterTeacherSchema>


