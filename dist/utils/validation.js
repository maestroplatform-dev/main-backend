"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherProfileUpdateSchema = exports.teacherOnboardingSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Auth validation schemas
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(120),
    role: zod_1.z.enum(['student', 'teacher', 'admin']).default('student'),
});
// Teacher onboarding schema
exports.teacherOnboardingSchema = zod_1.z.object({
    bio: zod_1.z.string().min(50, 'Bio must be at least 50 characters').max(1000),
    instruments: zod_1.z.array(zod_1.z.string()).min(1, 'At least one instrument required'),
    genres: zod_1.z.array(zod_1.z.string()).min(1, 'At least one genre required'),
    experience_years: zod_1.z.number().int().min(0).max(70),
    hourly_rate: zod_1.z.number().positive().optional(),
    location: zod_1.z.string().min(2),
    timezone: zod_1.z.string(), // e.g., "America/New_York"
});
// Teacher profile update schema
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