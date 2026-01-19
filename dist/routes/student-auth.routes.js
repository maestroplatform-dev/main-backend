"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const student_auth_controller_1 = require("../controllers/student-auth.controller");
const asyncHandler_1 = require("../utils/asyncHandler");
const studentAuthRouter = (0, express_1.Router)();
// Public routes (no authentication required)
/**
 * @route POST /api/v1/auth/student/send-otp
 * @desc Send OTP to student email for signup
 * @body { email: string }
 * @returns { success: boolean, message: string, debug_code?: string }
 */
studentAuthRouter.post('/send-otp', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.sendOTP));
/**
 * @route POST /api/v1/auth/student/verify-otp
 * @desc Verify OTP code
 * @body { email: string, otp_code: string }
 * @returns { success: boolean, message: string, email: string }
 */
studentAuthRouter.post('/verify-otp', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.verifyOTP));
/**
 * @route POST /api/v1/auth/student/resend-otp
 * @desc Resend OTP to email
 * @body { email: string }
 * @returns { success: boolean, message: string, debug_code?: string }
 */
studentAuthRouter.post('/resend-otp', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.resendOTP));
/**
 * @route POST /api/v1/auth/student/signup
 * @desc Complete email signup - create user and student profile
 * @body {
 *   email: string,
 *   name: string,
 *   gender: 'male' | 'female' | 'other',
 *   date_of_birth: ISO8601 string,
 *   password: string (min 8 chars, uppercase, number),
 *   guardian_name?: string,
 *   guardian_phone?: string (10 digits)
 * }
 * @returns { success: boolean, message: string, data: { user, student } }
 */
studentAuthRouter.post('/signup', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.completeEmailSignup));
/**
 * @route POST /api/v1/auth/student/complete-profile-google
 * @desc Complete Google OAuth signup - update user with profile info
 * @body {
 *   user_id: UUID,
 *   gender: 'male' | 'female' | 'other',
 *   date_of_birth: ISO8601 string,
 *   google_picture_url?: string,
 *   guardian_name?: string,
 *   guardian_phone?: string (10 digits)
 * }
 * @returns { success: boolean, message: string, data: { student } }
 */
studentAuthRouter.post('/complete-profile-google', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.completeGoogleSignup));
// Protected routes (require authentication)
// Note: Authentication middleware should be applied before these routes
/**
 * @route GET /api/v1/student/profile
 * @desc Get student profile (requires authentication)
 * @returns { success: boolean, data: { student } }
 */
studentAuthRouter.get('/profile', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.getProfile));
/**
 * @route GET /api/v1/student/package-card
 * @desc Get student package card points (requires authentication)
 * @returns { success: boolean, data: { package_card: { level, points, source } } }
 */
studentAuthRouter.get('/package-card', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.getPackageCard));
/**
 * @route PUT /api/v1/student/profile/picture
 * @desc Update student profile picture (requires authentication)
 * @body { picture_url: string }
 * @returns { success: boolean, message: string, data: { student } }
 */
studentAuthRouter.put('/profile/picture', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.updateProfilePicture));
// Development/debugging routes
if (process.env.NODE_ENV === 'development') {
    /**
     * @route GET /api/v1/student/otp-remaining-time/:email
     * @desc Get remaining time for OTP (development only)
     * @returns { success: boolean, email: string, remaining_seconds: number | null }
     */
    studentAuthRouter.get('/otp-remaining-time/:email', (0, asyncHandler_1.asyncHandler)(student_auth_controller_1.StudentAuthController.getOTPRemainingTime));
}
exports.default = studentAuthRouter;
//# sourceMappingURL=student-auth.routes.js.map