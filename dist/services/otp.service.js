"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTPService = void 0;
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;
// Simple in-memory store for OTPs (in production, use Redis)
// Structure: { email: { code: string, expiresAt: number, attempts: number } }
const otpStore = new Map();
class OTPService {
    /**
     * Generate and send OTP to email
     */
    static async generateAndSendOTP(email) {
        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
        // Store OTP in memory
        otpStore.set(email, {
            code,
            expiresAt,
            attempts: 0,
        });
        logger_1.default.info({ email, codeLength: code.length }, '📧 OTP generated');
        // TODO: Send via Resend email service
        // await EmailService.sendOTP(email, code)
        // For development, return the code (remove in production)
        if (process.env.NODE_ENV === 'development') {
            return { code };
        }
        return { code: '000000' }; // Don't expose real code in production
    }
    /**
     * Verify OTP code
     */
    static async verifyOTP(email, code) {
        const otpRecord = otpStore.get(email);
        if (!otpRecord) {
            throw new types_1.AppError(400, 'OTP not found or expired', 'OTP_NOT_FOUND');
        }
        // Check if OTP is expired
        if (Date.now() > otpRecord.expiresAt) {
            otpStore.delete(email);
            throw new types_1.AppError(400, 'OTP has expired', 'OTP_EXPIRED');
        }
        // Check max attempts
        if (otpRecord.attempts >= 5) {
            otpStore.delete(email);
            throw new types_1.AppError(429, 'Too many failed attempts', 'OTP_MAX_ATTEMPTS');
        }
        // Verify code
        if (otpRecord.code !== code) {
            otpRecord.attempts++;
            throw new types_1.AppError(400, 'Invalid OTP code', 'OTP_INVALID');
        }
        // OTP verified successfully - remove it
        otpStore.delete(email);
        logger_1.default.info({ email }, '✅ OTP verified successfully');
        return true;
    }
    /**
     * Clean up expired OTPs (run periodically)
     */
    static cleanupExpiredOTPs() {
        const now = Date.now();
        let cleaned = 0;
        for (const [email, record] of otpStore.entries()) {
            if (now > record.expiresAt) {
                otpStore.delete(email);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.default.info({ count: cleaned }, '🧹 Cleaned up expired OTPs');
        }
    }
    /**
     * Resend OTP (generate new one)
     */
    static async resendOTP(email) {
        // Check if user already has a valid OTP
        const existingOTP = otpStore.get(email);
        if (existingOTP && Date.now() < existingOTP.expiresAt) {
            throw new types_1.AppError(429, 'OTP was recently sent. Please wait before requesting a new one.', 'OTP_RECENTLY_SENT');
        }
        // Generate new OTP
        return this.generateAndSendOTP(email);
    }
    /**
     * Get remaining time for OTP (in seconds)
     */
    static getOTPRemainingTime(email) {
        const otpRecord = otpStore.get(email);
        if (!otpRecord)
            return null;
        const remaining = Math.ceil((otpRecord.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : null;
    }
}
exports.OTPService = OTPService;
//# sourceMappingURL=otp.service.js.map