import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<{
        teacher: "teacher";
        student: "student";
        admin: "admin";
    }>>;
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
export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingSchema>;
export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateSchema>;
//# sourceMappingURL=validation.d.ts.map