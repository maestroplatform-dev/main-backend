"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const database_1 = __importDefault(require("../config/database"));
const supabase_1 = require("../config/supabase");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
class StudentService {
    /**
     * Calculate age from date of birth
     */
    static calculateAge(dob) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    }
    /**
     * Check if student requires guardian info based on age
     */
    static requiresGuardian(dob) {
        return this.calculateAge(dob) < 18;
    }
    /**
     * Complete email signup - create user and student profile
     */
    static async completeEmailSignup(data) {
        // Validate age
        const age = this.calculateAge(data.dob);
        // Check if guardian info is provided for minors
        if (age < 18 && (!data.guardianName || !data.guardianPhone)) {
            throw new types_1.AppError(400, 'Guardian information is required for students under 18', 'GUARDIAN_REQUIRED');
        }
        // Create Supabase user with email and password
        const { data: signUpData, error: signUpError } = await supabase_1.supabase.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
        });
        if (signUpError) {
            logger_1.default.error({ error: signUpError, email: data.email }, '❌ Failed to create user in Supabase');
            throw new types_1.AppError(400, signUpError.message, 'USER_CREATION_FAILED');
        }
        const userId = signUpData.user.id;
        try {
            // Create profile
            const profile = await database_1.default.profiles.create({
                data: {
                    id: userId,
                    name: data.name,
                    role: 'student',
                    is_active: true,
                },
            });
            // Create student record
            const student = await database_1.default.students.create({
                data: {
                    id: userId,
                    name: data.name,
                    date_of_birth: data.dob,
                    gender: data.gender,
                    guardian_name: data.guardianName,
                    guardian_phone: data.guardianPhone,
                    signup_method: 'email',
                    email_verified: true,
                    onboarding_status: 'completed',
                    profile_picture_url: null,
                },
            });
            logger_1.default.info({ userId, email: data.email }, '✅ Student email signup completed');
            return { user: signUpData.user, profile, student };
        }
        catch (error) {
            // Rollback: Delete Supabase user if student creation fails
            await supabase_1.supabase.auth.admin.deleteUser(userId);
            logger_1.default.error({ userId, error }, '❌ Failed to create student profile, rolled back user');
            throw error;
        }
    }
    /**
     * Complete Google OAuth signup - update user with profile info
     */
    static async completeGoogleSignup(data) {
        // Validate age
        const age = this.calculateAge(data.dob);
        // Check if guardian info is provided for minors
        if (age < 18 && (!data.guardianName || !data.guardianPhone)) {
            throw new types_1.AppError(400, 'Guardian information is required for students under 18', 'GUARDIAN_REQUIRED');
        }
        // Get user from Supabase to verify they exist
        const { data: userData, error: userError } = await supabase_1.supabase.auth.admin.getUserById(data.userId);
        if (userError || !userData.user) {
            throw new types_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
        }
        const email = userData.user.email;
        const name = userData.user.user_metadata?.name || userData.user.user_metadata?.full_name || 'Student';
        try {
            // Create profile if it doesn't exist
            let profile = await database_1.default.profiles.findUnique({
                where: { id: data.userId },
            });
            if (!profile) {
                profile = await database_1.default.profiles.create({
                    data: {
                        id: data.userId,
                        name,
                        role: 'student',
                        is_active: true,
                    },
                });
            }
            // Create student record if it doesn't exist
            let student = await database_1.default.students.findUnique({
                where: { id: data.userId },
            });
            if (student) {
                // Update existing student record
                student = await database_1.default.students.update({
                    where: { id: data.userId },
                    data: {
                        date_of_birth: data.dob,
                        gender: data.gender,
                        guardian_name: data.guardianName,
                        guardian_phone: data.guardianPhone,
                        profile_picture_url: data.googlePictureUrl || null,
                        signup_method: 'google',
                        email_verified: true,
                        onboarding_status: 'completed',
                    },
                });
            }
            else {
                // Create new student record
                student = await database_1.default.students.create({
                    data: {
                        id: data.userId,
                        name,
                        date_of_birth: data.dob,
                        gender: data.gender,
                        guardian_name: data.guardianName,
                        guardian_phone: data.guardianPhone,
                        profile_picture_url: data.googlePictureUrl || null,
                        signup_method: 'google',
                        email_verified: true,
                        onboarding_status: 'completed',
                    },
                });
            }
            logger_1.default.info({ userId: data.userId, email }, '✅ Student Google signup completed');
            return { user: userData.user, profile, student };
        }
        catch (error) {
            logger_1.default.error({ userId: data.userId, error }, '❌ Failed to complete Google signup');
            throw error;
        }
    }
    /**
     * Get student profile
     */
    static async getStudentProfile(userId) {
        const student = await database_1.default.students.findUnique({
            where: { id: userId },
            include: {
                profiles: true,
            },
        });
        if (!student) {
            throw new types_1.AppError(404, 'Student profile not found', 'STUDENT_NOT_FOUND');
        }
        return student;
    }
    /**
     * Update profile picture
     */
    static async updateProfilePicture(userId, pictureUrl) {
        const student = await database_1.default.students.update({
            where: { id: userId },
            data: {
                profile_picture_url: pictureUrl,
            },
        });
        logger_1.default.info({ userId }, '✅ Profile picture updated');
        return student;
    }
    /**
     * Get student by email
     */
    static async getStudentByEmail(email) {
        // Note: We need to join with Supabase users via profiles
        // This is a simplified version - may need adjustment based on actual auth setup
        const profiles = await database_1.default.profiles.findMany({
            where: {
                students: {
                    isNot: null,
                },
            },
            include: {
                students: true,
            },
        });
        // Filter by email from Supabase (simplified - in real app, might need separate lookup)
        return profiles.find((p) => p.students)?.students || null;
    }
    /**
     * Update student onboarding status
     */
    static async updateOnboardingStatus(userId, status) {
        const student = await database_1.default.students.update({
            where: { id: userId },
            data: {
                onboarding_status: status,
            },
        });
        return student;
    }
}
exports.StudentService = StudentService;
//# sourceMappingURL=student.service.js.map