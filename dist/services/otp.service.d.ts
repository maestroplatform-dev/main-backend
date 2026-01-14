export declare class OTPService {
    /**
     * Generate and send OTP to email
     */
    static generateAndSendOTP(email: string): Promise<{
        code: string;
    }>;
    /**
     * Verify OTP code
     */
    static verifyOTP(email: string, code: string): Promise<boolean>;
    /**
     * Clean up expired OTPs (run periodically)
     */
    static cleanupExpiredOTPs(): void;
    /**
     * Resend OTP (generate new one)
     */
    static resendOTP(email: string): Promise<{
        code: string;
    }>;
    /**
     * Get remaining time for OTP (in seconds)
     */
    static getOTPRemainingTime(email: string): number | null;
    /**
     * OTP Email Template
     */
    private static getOTPEmailTemplate;
}
//# sourceMappingURL=otp.service.d.ts.map