import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<{
        teacher: "teacher";
        student: "student";
        admin: "admin";
    }>>;
}, z.core.$strip>;
export declare const studentSendOTPSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const studentVerifyOTPSchema: z.ZodObject<{
    email: z.ZodString;
    otp_code: z.ZodString;
}, z.core.$strip>;
export declare const studentResendOTPSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const studentCompleteEmailSignupSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    gender: z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
    }>;
    date_of_birth: z.ZodString;
    password: z.ZodString;
    guardian_name: z.ZodOptional<z.ZodString>;
    guardian_phone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const studentCompleteGoogleSignupSchema: z.ZodObject<{
    user_id: z.ZodString;
    gender: z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
    }>;
    date_of_birth: z.ZodString;
    google_picture_url: z.ZodOptional<z.ZodString>;
    guardian_name: z.ZodOptional<z.ZodString>;
    guardian_phone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const studentUpdateProfilePictureSchema: z.ZodObject<{
    picture_url: z.ZodString;
}, z.core.$strip>;
export type StudentSendOTPInput = z.infer<typeof studentSendOTPSchema>;
export type StudentVerifyOTPInput = z.infer<typeof studentVerifyOTPSchema>;
export type StudentResendOTPInput = z.infer<typeof studentResendOTPSchema>;
export type StudentCompleteEmailSignupInput = z.infer<typeof studentCompleteEmailSignupSchema>;
export type StudentCompleteGoogleSignupInput = z.infer<typeof studentCompleteGoogleSignupSchema>;
export type StudentUpdateProfilePictureInput = z.infer<typeof studentUpdateProfilePictureSchema>;
export declare const teacherCompleteOnboardingSchema: z.ZodObject<{
    phone: z.ZodString;
    date_of_birth: z.ZodString;
    languages: z.ZodArray<z.ZodString>;
    music_experience_years: z.ZodNumber;
    teaching_experience_years: z.ZodNumber;
    performance_experience_years: z.ZodNumber;
    current_city: z.ZodString;
    pincode: z.ZodString;
    media_consent: z.ZodBoolean;
    profile_picture: z.ZodOptional<z.ZodString>;
    demo: z.ZodOptional<z.ZodBoolean>;
    tagline: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    teaching_style: z.ZodOptional<z.ZodString>;
    education: z.ZodOptional<z.ZodString>;
    professional_experience: z.ZodOptional<z.ZodString>;
    youtube_links: z.ZodDefault<z.ZodArray<z.ZodString>>;
    engagement_type: z.ZodEnum<{
        Teaching: "Teaching";
        Performance: "Performance";
        Both: "Both";
    }>;
    collaborative_projects: z.ZodDefault<z.ZodArray<z.ZodString>>;
    collaborative_other: z.ZodOptional<z.ZodString>;
    performance_fee_per_hour: z.ZodOptional<z.ZodNumber>;
    class_formats: z.ZodDefault<z.ZodArray<z.ZodString>>;
    class_formats_other: z.ZodOptional<z.ZodString>;
    exam_training: z.ZodDefault<z.ZodArray<z.ZodString>>;
    exam_training_other: z.ZodOptional<z.ZodString>;
    additional_formats: z.ZodDefault<z.ZodArray<z.ZodString>>;
    additional_formats_other: z.ZodOptional<z.ZodString>;
    learner_groups: z.ZodDefault<z.ZodArray<z.ZodString>>;
    learner_groups_other: z.ZodOptional<z.ZodString>;
    performance_settings: z.ZodDefault<z.ZodArray<z.ZodString>>;
    performance_settings_other: z.ZodOptional<z.ZodString>;
    other_contribution: z.ZodOptional<z.ZodString>;
    instruments: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        teach_or_perform: z.ZodLiteral<"Teach">;
        instrument: z.ZodString;
        class_mode: z.ZodEnum<{
            online: "online";
            offline: "offline";
        }>;
        tiers: z.ZodArray<z.ZodObject<{
            level: z.ZodEnum<{
                beginner: "beginner";
                intermediate: "intermediate";
                advanced: "advanced";
            }>;
            price_inr: z.ZodNumber;
            platform_markup_inr: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        teach_or_perform: z.ZodLiteral<"Perform">;
        instrument: z.ZodString;
        performance_fee_inr: z.ZodNumber;
        platform_markup_inr: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "teach_or_perform">>;
    open_to_international: z.ZodDefault<z.ZodBoolean>;
    international_premium: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const teacherOnboardingSchema: z.ZodObject<{
    bio: z.ZodString;
    instruments: z.ZodArray<z.ZodString>;
    genres: z.ZodArray<z.ZodString>;
    experience_years: z.ZodNumber;
    hourly_rate: z.ZodOptional<z.ZodNumber>;
    location: z.ZodString;
    timezone: z.ZodString;
}, z.core.$strip>;
export declare const teacherProfileUpdateSchema: z.ZodObject<{
    bio: z.ZodOptional<z.ZodString>;
    instruments: z.ZodOptional<z.ZodArray<z.ZodString>>;
    genres: z.ZodOptional<z.ZodArray<z.ZodString>>;
    experience_years: z.ZodOptional<z.ZodNumber>;
    hourly_rate: z.ZodOptional<z.ZodNumber>;
    location: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type TeacherCompleteOnboardingInput = z.infer<typeof teacherCompleteOnboardingSchema>;
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>;
export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateSchema>;
//# sourceMappingURL=validation.d.ts.map