"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherProfileUpdateSchema = exports.teacherOnboardingSchema = exports.teacherCompleteOnboardingSchema = exports.studentUpdateProfilePictureSchema = exports.studentCompleteGoogleSignupSchema = exports.studentCompleteEmailSignupSchema = exports.studentResendOTPSchema = exports.studentVerifyOTPSchema = exports.studentSendOTPSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Auth validation schemas
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(120),
    role: zod_1.z.enum(['student', 'teacher', 'admin']).default('student'),
});
// ============================================================
// STUDENT SIGNUP SCHEMAS
// ============================================================
exports.studentSendOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.studentVerifyOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    otp_code: zod_1.z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
});
exports.studentResendOTPSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
exports.studentCompleteEmailSignupSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(120),
    gender: zod_1.z.enum(['male', 'female', 'other']),
    date_of_birth: zod_1.z.string().refine((date) => {
        const dob = new Date(date);
        const today = new Date();
        return dob < today && dob.getFullYear() >= 1900;
    }, 'Invalid date of birth'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain uppercase letter').regex(/[0-9]/, 'Password must contain a number'),
    guardian_name: zod_1.z.string().optional(),
    guardian_phone: zod_1.z
        .string()
        .regex(/^\d{10}$/, 'Phone must be 10 digits')
        .optional(),
});
exports.studentCompleteGoogleSignupSchema = zod_1.z.object({
    user_id: zod_1.z.string().uuid('Invalid user ID'),
    gender: zod_1.z.enum(['male', 'female', 'other']),
    date_of_birth: zod_1.z.string().refine((date) => {
        const dob = new Date(date);
        const today = new Date();
        return dob < today && dob.getFullYear() >= 1900;
    }, 'Invalid date of birth'),
    google_picture_url: zod_1.z.string().url('Invalid picture URL').optional(),
    guardian_name: zod_1.z.string().optional(),
    guardian_phone: zod_1.z
        .string()
        .regex(/^\d{10}$/, 'Phone must be 10 digits')
        .optional(),
});
exports.studentUpdateProfilePictureSchema = zod_1.z.object({
    picture_url: zod_1.z.string().url('Invalid picture URL'),
});
// ============================================================
// TEACHER ONBOARDING SCHEMAS (EXISTING)
// ============================================================
// Comprehensive Teacher Onboarding Schema (all steps in one)
exports.teacherCompleteOnboardingSchema = zod_1.z.object({
    // Step 2: Basic Information
    phone: zod_1.z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    date_of_birth: zod_1.z.string().datetime(),
    languages: zod_1.z.array(zod_1.z.string()).min(1, 'At least one language required'),
    music_experience_years: zod_1.z.number().int().min(0).max(70),
    teaching_experience_years: zod_1.z.number().int().min(0).max(70),
    performance_experience_years: zod_1.z.number().int().min(0).max(70),
    current_city: zod_1.z.string().min(1),
    pincode: zod_1.z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    media_consent: zod_1.z.boolean(),
    profile_picture: zod_1.z.string().url('Invalid picture URL').optional(),
    // Profile Details (optional fields)
    demo: zod_1.z.boolean().optional(),
    tagline: zod_1.z.string().max(150, 'Tagline must not exceed 150 characters').optional(),
    teaching_style: zod_1.z.string().optional(),
    education: zod_1.z.string().optional(),
    professional_experience: zod_1.z.string().optional(),
    youtube_links: zod_1.z.array(zod_1.z.string().url('Invalid YouTube URL')).default([]),
    // Step 3: Engagement Preferences
    engagement_type: zod_1.z.enum(['Teaching', 'Performance', 'Both']),
    collaborative_projects: zod_1.z.array(zod_1.z.string()).default([]),
    collaborative_other: zod_1.z.string().optional(),
    performance_fee_per_hour: zod_1.z.number().nonnegative().optional(),
    // Step 3: Teaching Formats
    class_formats: zod_1.z.array(zod_1.z.string()).default([]),
    class_formats_other: zod_1.z.string().optional(),
    exam_training: zod_1.z.array(zod_1.z.string()).default([]),
    exam_training_other: zod_1.z.string().optional(),
    additional_formats: zod_1.z.array(zod_1.z.string()).default([]),
    additional_formats_other: zod_1.z.string().optional(),
    learner_groups: zod_1.z.array(zod_1.z.string()).default([]),
    learner_groups_other: zod_1.z.string().optional(),
    // Step 3: Performance Settings
    performance_settings: zod_1.z.array(zod_1.z.string()).default([]),
    performance_settings_other: zod_1.z.string().optional(),
    other_contribution: zod_1.z.string().optional(),
    // Step 4: Instruments & Pricing (Teach vs Perform)
    instruments: zod_1.z
        .array(zod_1.z.discriminatedUnion('teach_or_perform', [
        zod_1.z.object({
            teach_or_perform: zod_1.z.literal('Teach'),
            instrument: zod_1.z.string().min(1),
            class_mode: zod_1.z.enum(['online', 'offline']),
            tiers: zod_1.z
                .array(zod_1.z.object({
                level: zod_1.z.enum(['beginner', 'intermediate', 'advanced']),
                price_inr: zod_1.z.number().positive(),
            }))
                .length(3, 'Provide beginner, intermediate, and advanced pricing'),
        }),
        zod_1.z.object({
            teach_or_perform: zod_1.z.literal('Perform'),
            instrument: zod_1.z.string().min(1),
            performance_fee_inr: zod_1.z.number().positive(),
        }),
    ]))
        .min(1),
    open_to_international: zod_1.z.boolean().default(false),
    international_premium: zod_1.z.number().nonnegative().default(0),
});
// Old schemas (kept for compatibility)
exports.teacherOnboardingSchema = zod_1.z.object({
    bio: zod_1.z.string().min(50, 'Bio must be at least 50 characters').max(1000),
    instruments: zod_1.z.array(zod_1.z.string()).min(1, 'At least one instrument required'),
    genres: zod_1.z.array(zod_1.z.string()).min(1, 'At least one genre required'),
    experience_years: zod_1.z.number().int().min(0).max(70),
    hourly_rate: zod_1.z.number().positive().optional(),
    location: zod_1.z.string().min(2),
    timezone: zod_1.z.string(),
});
exports.teacherProfileUpdateSchema = zod_1.z.object({
    bio: zod_1.z.string().min(50).max(1000).optional(),
    instruments: zod_1.z.array(zod_1.z.string()).min(1).optional(),
    genres: zod_1.z.array(zod_1.z.string()).min(1).optional(),
    experience_years: zod_1.z.number().int().min(0).max(70).optional(),
    hourly_rate: zod_1.z.number().positive().optional(),
    location: zod_1.z.string().min(2).optional(),
    timezone: zod_1.z.string().optional(),
});
//# sourceMappingURL=validation.js.map