import { Request, Response, NextFunction } from 'express';
export declare class StudentAuthController {
    /**
     * POST /api/v1/auth/student/send-otp
     * Send OTP to student email
     */
    static sendOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/student/verify-otp
     * Verify OTP code
     */
    static verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/student/resend-otp
     * Resend OTP to email
     */
    static resendOTP(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/student/signup
     * Complete email signup - create user and student profile
     */
    static completeEmailSignup(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/v1/auth/student/complete-profile-google
     * Complete Google OAuth signup - update user with profile info
     */
    static completeGoogleSignup(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/v1/student/profile
     * Get student profile (requires authentication)
     */
    static getProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/v1/student/profile/picture
     * Update student profile picture (requires authentication)
     */
    static updateProfilePicture(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/v1/student/otp-remaining-time/:email
     * Get remaining time for OTP (development/debugging only)
     */
    static getOTPRemainingTime(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=student-auth.controller.d.ts.map