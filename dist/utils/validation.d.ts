import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<{
        teacher: "teacher";
        student: "student";
        admin: "admin";
    }>>;
}, z.core.$strip>;
export declare const teacherCompleteOnboardingSchema: z.ZodObject<{
    phone: z.ZodString;
    date_of_birth: z.ZodString;
    languages: z.ZodArray<z.ZodString>;
    music_experience_years: z.ZodNumber;
    teaching_experience_years: z.ZodNumber;
    performance_experience_years: z.ZodNumber;
    current_city: z.ZodString;
    pincode: z.ZodString;
    demo_session_available: z.ZodBoolean;
    media_consent: z.ZodBoolean;
    engagement_type: z.ZodEnum<{
        Teaching: "Teaching";
        Performance: "Performance";
        Both: "Both";
    }>;
    collaborative_projects: z.ZodDefault<z.ZodArray<z.ZodString>>;
    collaborative_other: z.ZodOptional<z.ZodString>;
    class_formats: z.ZodArray<z.ZodString>;
    class_formats_other: z.ZodOptional<z.ZodString>;
    exam_training: z.ZodDefault<z.ZodArray<z.ZodString>>;
    exam_training_other: z.ZodOptional<z.ZodString>;
    additional_formats: z.ZodDefault<z.ZodArray<z.ZodString>>;
    additional_formats_other: z.ZodOptional<z.ZodString>;
    learner_groups: z.ZodArray<z.ZodString>;
    learner_groups_other: z.ZodOptional<z.ZodString>;
    other_contribution: z.ZodOptional<z.ZodString>;
    instruments: z.ZodArray<z.ZodObject<{
        instrument: z.ZodString;
        teach_or_perform: z.ZodEnum<{
            Teach: "Teach";
            Perform: "Perform";
        }>;
        base_price: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    open_to_international: z.ZodBoolean;
    international_premium: z.ZodOptional<z.ZodNumber>;
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