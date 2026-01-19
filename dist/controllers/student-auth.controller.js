"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentAuthController = void 0;
const otp_service_1 = require("../services/otp.service");
const student_service_1 = require("../services/student.service");
const package_card_service_1 = require("../services/package-card.service");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const validation_1 = require("../utils/validation");
class StudentAuthController {
    /**
     * POST /api/v1/auth/student/send-otp
     * Send OTP to student email
     */
    static async sendOTP(req, res, next) {
        try {
            const { email } = validation_1.studentSendOTPSchema.parse(req.body);
            // Generate and send OTP
            const { code } = await otp_service_1.OTPService.generateAndSendOTP(email);
            // TODO: Send OTP via email service
            logger_1.default.info({ email }, '📧 OTP sent to email');
            res.json({
                success: true,
                message: 'OTP sent to your email. Valid for 10 minutes.',
                // Don't expose code in production
                ...(process.env.NODE_ENV === 'development' && { debug_code: code }),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/student/verify-otp
     * Verify OTP code
     */
    static async verifyOTP(req, res, next) {
        try {
            const { email, otp_code } = validation_1.studentVerifyOTPSchema.parse(req.body);
            // Verify OTP
            await otp_service_1.OTPService.verifyOTP(email, otp_code);
            // Store verified email in session (frontend will handle session storage)
            res.json({
                success: true,
                message: 'OTP verified successfully',
                email,
                // In production, you might return a temporary token here
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/student/resend-otp
     * Resend OTP to email
     */
    static async resendOTP(req, res, next) {
        try {
            const { email } = validation_1.studentResendOTPSchema.parse(req.body);
            // Resend OTP
            const { code } = await otp_service_1.OTPService.resendOTP(email);
            logger_1.default.info({ email }, '📧 OTP resent to email');
            res.json({
                success: true,
                message: 'OTP resent to your email',
                ...(process.env.NODE_ENV === 'development' && { debug_code: code }),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/student/signup
     * Complete email signup - create user and student profile
     */
    static async completeEmailSignup(req, res, next) {
        try {
            const parsedData = validation_1.studentCompleteEmailSignupSchema.parse(req.body);
            // Complete signup
            const result = await student_service_1.StudentService.completeEmailSignup({
                email: parsedData.email,
                name: parsedData.name,
                gender: parsedData.gender,
                dob: new Date(parsedData.date_of_birth),
                password: parsedData.password,
                guardianName: parsedData.guardian_name,
                guardianPhone: parsedData.guardian_phone,
            });
            logger_1.default.info({ userId: result.user.id, email: result.student }, '✅ Student signup completed');
            res.status(201).json({
                success: true,
                message: 'Student account created successfully',
                data: {
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                    },
                    student: {
                        id: result.student.id,
                        name: result.student.name,
                        gender: result.student.gender,
                        profile_picture_url: result.student.profile_picture_url,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/auth/student/complete-profile-google
     * Complete Google OAuth signup - update user with profile info
     */
    static async completeGoogleSignup(req, res, next) {
        try {
            const parsedData = validation_1.studentCompleteGoogleSignupSchema.parse(req.body);
            // Complete Google signup
            const result = await student_service_1.StudentService.completeGoogleSignup({
                userId: parsedData.user_id,
                dob: new Date(parsedData.date_of_birth),
                gender: parsedData.gender,
                googlePictureUrl: parsedData.google_picture_url,
                guardianName: parsedData.guardian_name,
                guardianPhone: parsedData.guardian_phone,
            });
            logger_1.default.info({ userId: result.user.id }, '✅ Google signup profile completed');
            res.status(200).json({
                success: true,
                message: 'Profile completed successfully',
                data: {
                    student: {
                        id: result.student.id,
                        name: result.student.name,
                        gender: result.student.gender,
                        date_of_birth: result.student.date_of_birth,
                        profile_picture_url: result.student.profile_picture_url,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/v1/student/profile
     * Get student profile (requires authentication)
     */
    static async getProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new types_1.AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED');
            }
            const student = await student_service_1.StudentService.getStudentProfile(userId);
            res.json({
                success: true,
                data: {
                    student: {
                        id: student.id,
                        name: student.name,
                        gender: student.gender,
                        date_of_birth: student.date_of_birth,
                        profile_picture_url: student.profile_picture_url,
                        guardian_name: student.guardian_name,
                        guardian_phone: student.guardian_phone,
                        signup_method: student.signup_method,
                        email_verified: student.email_verified,
                        onboarding_status: student.onboarding_status,
                        created_at: student.created_at,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/v1/student/package-card
     * Get package card points for the student (requires authentication)
     */
    static async getPackageCard(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new types_1.AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED');
            }
            const card = await package_card_service_1.PackageCardService.getForStudent(userId);
            res.json({
                success: true,
                data: {
                    package_card: card,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/v1/student/profile/picture
     * Update student profile picture (requires authentication)
     */
    static async updateProfilePicture(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new types_1.AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED');
            }
            const { picture_url } = validation_1.studentUpdateProfilePictureSchema.parse(req.body);
            const student = await student_service_1.StudentService.updateProfilePicture(userId, picture_url);
            res.json({
                success: true,
                message: 'Profile picture updated successfully',
                data: {
                    student: {
                        id: student.id,
                        profile_picture_url: student.profile_picture_url,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/v1/student/otp-remaining-time/:email
     * Get remaining time for OTP (development/debugging only)
     */
    static async getOTPRemainingTime(req, res, next) {
        try {
            if (process.env.NODE_ENV !== 'development') {
                throw new types_1.AppError(403, 'This endpoint is only available in development', 'FORBIDDEN');
            }
            const { email } = req.params;
            const remaining = otp_service_1.OTPService.getOTPRemainingTime(email);
            res.json({
                success: true,
                email,
                remaining_seconds: remaining,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.StudentAuthController = StudentAuthController;
//# sourceMappingURL=student-auth.controller.js.map