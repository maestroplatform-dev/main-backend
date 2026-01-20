import { z } from 'zod'

// Auth validation schemas
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  role: z.enum(['student', 'teacher', 'admin']).default('student'),
})

// ============================================================
// STUDENT SIGNUP SCHEMAS
// ============================================================

export const studentSendOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const studentVerifyOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp_code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
})

export const studentResendOTPSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const studentCompleteEmailSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  gender: z.enum(['male', 'female', 'other']),
  date_of_birth: z.string().refine((date) => {
    const dob = new Date(date)
    const today = new Date()
    return dob < today && dob.getFullYear() >= 1900
  }, 'Invalid date of birth'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain uppercase letter').regex(/[0-9]/, 'Password must contain a number'),
  guardian_name: z.string().optional(),
  guardian_phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be 10 digits')
    .optional(),
})

export const studentCompleteGoogleSignupSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  gender: z.enum(['male', 'female', 'other']),
  date_of_birth: z.string().refine((date) => {
    const dob = new Date(date)
    const today = new Date()
    return dob < today && dob.getFullYear() >= 1900
  }, 'Invalid date of birth'),
  google_picture_url: z.string().url('Invalid picture URL').optional(),
  guardian_name: z.string().optional(),
  guardian_phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be 10 digits')
    .optional(),
})

export const studentUpdateProfilePictureSchema = z.object({
  picture_url: z.string().url('Invalid picture URL'),
})

// ============================================================
// PACKAGE CARD (STUDENT DASHBOARD)
// ============================================================

export const studentLevelSchema = z.enum(['beginner', 'intermediate', 'advanced'])

export const packageCardPointsSchema = z
  .array(z.string().min(1, 'Point cannot be empty').max(160, 'Point too long'))
  .length(4, 'Package card must have exactly 4 points')

export const adminUpsertPackageCardTemplateSchema = z.object({
  points: packageCardPointsSchema,
})

export const adminUpdateStudentPackageCardSchema = z
  .object({
    level: studentLevelSchema.optional(),
    points: packageCardPointsSchema.optional(),
    clear_override: z.boolean().optional(),
  })
  .refine((val) => val.level || val.points || val.clear_override, {
    message: 'Provide at least one of level, points, or clear_override',
  })

// Types
export type StudentSendOTPInput = z.infer<typeof studentSendOTPSchema>
export type StudentVerifyOTPInput = z.infer<typeof studentVerifyOTPSchema>
export type StudentResendOTPInput = z.infer<typeof studentResendOTPSchema>
export type StudentCompleteEmailSignupInput = z.infer<typeof studentCompleteEmailSignupSchema>
export type StudentCompleteGoogleSignupInput = z.infer<typeof studentCompleteGoogleSignupSchema>
export type StudentUpdateProfilePictureInput = z.infer<typeof studentUpdateProfilePictureSchema>

export type StudentLevelInput = z.infer<typeof studentLevelSchema>
export type AdminUpsertPackageCardTemplateInput = z.infer<typeof adminUpsertPackageCardTemplateSchema>
export type AdminUpdateStudentPackageCardInput = z.infer<typeof adminUpdateStudentPackageCardSchema>

// ============================================================
// TEACHER ONBOARDING SCHEMAS (EXISTING)
// ============================================================

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
  media_consent: z.boolean(),
  profile_picture: z.string().url('Invalid picture URL').optional(),
  
  // Profile Details (optional fields)
  demo: z.boolean().optional(),
  tagline: z.string().max(50, 'Tagline must not exceed 50 characters').optional(),
  bio: z.string().optional(),
  teaching_style: z.string().optional(),
  education: z.string().optional(),
  professional_experience: z.string().optional(),
  youtube_links: z.array(z.string().url('Invalid YouTube URL')).default([]),

  // Step 3: Engagement Preferences
  engagement_type: z.enum(['Teaching', 'Performance', 'Both']),
  collaborative_projects: z.array(z.string()).default([]),
  collaborative_other: z.string().optional(),
  performance_fee_per_hour: z.number().nonnegative().optional(),

  // Step 3: Teaching Formats
  class_formats: z.array(z.string()).default([]),
  class_formats_other: z.string().optional(),
  exam_training: z.array(z.string()).default([]),
  exam_training_other: z.string().optional(),
  additional_formats: z.array(z.string()).default([]),
  additional_formats_other: z.string().optional(),
  learner_groups: z.array(z.string()).default([]),
  learner_groups_other: z.string().optional(),
  
  // Step 3: Performance Settings
  performance_settings: z.array(z.string()).default([]),
  performance_settings_other: z.string().optional(),
  
  other_contribution: z.string().optional(),

  // Global pricing
  starting_price_inr: z.number().nonnegative().optional(),

  // Step 4: Instruments & Pricing (Teach vs Perform)
  instruments: z
    .array(
      z.discriminatedUnion('teach_or_perform', [
        z.object({
          teach_or_perform: z.literal('Teach'),
          instrument: z.string().min(1),
          class_mode: z.enum(['online', 'offline']),
          one_on_one_price_inr: z.number().nonnegative().optional(),
          tiers: z
            .array(
              z.object({
                level: z.enum(['beginner', 'intermediate', 'advanced']),
                // Teacher's net price per class (what teacher earns)
                price_inr: z.number().positive(),
                // Optional platform markup Maestera adds on top for students
                platform_markup_inr: z.number().nonnegative().optional(),
                // Level-specific one-on-one price
                one_on_one_price_inr: z.number().nonnegative().optional(),
              })
            )
            .length(3, 'Provide beginner, intermediate, and advanced pricing'),
          package_card_points: z.object({
            beginner: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
            intermediate: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
            advanced: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
          }),
        }),
        z.object({
          teach_or_perform: z.literal('Perform'),
          instrument: z.string().min(1),
          // Teacher's net performance fee
          performance_fee_inr: z.number().positive(),
          // Optional platform markup on performance bookings
          platform_markup_inr: z.number().nonnegative().optional(),
          one_on_one_price_inr: z.number().nonnegative().optional(),
          package_card_points: z.object({
            beginner: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
            intermediate: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
            advanced: z.object({
              "10": z.array(z.string().min(1)).length(4),
              "20": z.array(z.string().min(1)).length(4),
              "30": z.array(z.string().min(1)).length(4),
            }),
          }),
        }),
      ])
    )
    .min(1),

  open_to_international: z.boolean().default(false),
  international_premium: z.number().nonnegative().default(0),
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

export type RegisterInput = z.infer<typeof registerSchema>
export type TeacherCompleteOnboardingInput = z.infer<typeof teacherCompleteOnboardingSchema>
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>
export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateSchema>
