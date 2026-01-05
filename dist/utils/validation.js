"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRegisterTeacherSchema = exports.teacherProfileUpdateSchema = exports.teacherOnboardingSchema = exports.teacherCompleteOnboardingSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Auth validation schemas
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(120),
    role: zod_1.z.enum(['student', 'teacher', 'admin']).default('student'),
});
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
    demo_session_available: zod_1.z.boolean(),
    media_consent: zod_1.z.boolean(),
    // Step 3: Engagement Preferences
    engagement_type: zod_1.z.enum(['Teaching', 'Performance', 'Both']),
    collaborative_projects: zod_1.z.array(zod_1.z.string()).default([]),
    collaborative_other: zod_1.z.string().optional(),
    // Step 3: Teaching Formats
    class_formats: zod_1.z.array(zod_1.z.string()).min(1),
    class_formats_other: zod_1.z.string().optional(),
    exam_training: zod_1.z.array(zod_1.z.string()).default([]),
    exam_training_other: zod_1.z.string().optional(),
    additional_formats: zod_1.z.array(zod_1.z.string()).default([]),
    additional_formats_other: zod_1.z.string().optional(),
    learner_groups: zod_1.z.array(zod_1.z.string()).min(1),
    learner_groups_other: zod_1.z.string().optional(),
    other_contribution: zod_1.z.string().optional(),
    // Step 4: Instruments & Pricing
    instruments: zod_1.z
        .array(zod_1.z.object({
        instrument: zod_1.z.string().min(1),
        teach_or_perform: zod_1.z.enum(['Teach', 'Perform']),
        base_price: zod_1.z.number().positive().optional(),
    }))
        .min(1),
    open_to_international: zod_1.z.boolean(),
    international_premium: zod_1.z.number().nonnegative().optional(),
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
// Admin Teacher Registration Schema (register on behalf of teacher)
exports.adminRegisterTeacherSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    name: zod_1.z.string().min(1, 'Teacher name is required').max(120),
    // Step 2: Basic Information
    phone: zod_1.z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    date_of_birth: zod_1.z.string().datetime(),
    languages: zod_1.z.array(zod_1.z.string()).min(1, 'At least one language required'),
    music_experience_years: zod_1.z.number().int().min(0).max(70),
    teaching_experience_years: zod_1.z.number().int().min(0).max(70),
    performance_experience_years: zod_1.z.number().int().min(0).max(70),
    current_city: zod_1.z.string().min(1),
    pincode: zod_1.z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    demo_session_available: zod_1.z.boolean(),
    media_consent: zod_1.z.boolean(),
    // Step 3: Engagement Preferences
    engagement_type: zod_1.z.enum(['Teaching', 'Performance', 'Both']),
    collaborative_projects: zod_1.z.array(zod_1.z.string()).default([]),
    collaborative_other: zod_1.z.string().optional(),
    // Step 3: Teaching Formats
    class_formats: zod_1.z.array(zod_1.z.string()).min(1),
    class_formats_other: zod_1.z.string().optional(),
    exam_training: zod_1.z.array(zod_1.z.string()).default([]),
    exam_training_other: zod_1.z.string().optional(),
    additional_formats: zod_1.z.array(zod_1.z.string()).default([]),
    additional_formats_other: zod_1.z.string().optional(),
    learner_groups: zod_1.z.array(zod_1.z.string()).min(1),
    learner_groups_other: zod_1.z.string().optional(),
    other_contribution: zod_1.z.string().optional(),
    // Step 4: Instruments & Pricing
    instruments: zod_1.z
        .array(zod_1.z.object({
        instrument: zod_1.z.string().min(1),
        teach_or_perform: zod_1.z.enum(['Teach', 'Perform']),
        base_price: zod_1.z.number().positive().optional(),
    }))
        .min(1),
    open_to_international: zod_1.z.boolean(),
    international_premium: zod_1.z.number().nonnegative().optional(),
});
//# sourceMappingURL=validation.js.map