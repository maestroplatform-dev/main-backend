"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTPService = void 0;
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const resend_1 = require("resend");
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;
// Initialize Resend
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@maestera.com';
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
        logger_1.default.info({ email, code }, '📧 OTP generated');
        // Send email via Resend
        try {
            await resend.emails.send({
                from: FROM_EMAIL,
                to: email,
                subject: '🎵 Your Maestera OTP Code',
                html: this.getOTPEmailTemplate(code),
            });
            logger_1.default.info({ email }, '✅ OTP email sent successfully');
        }
        catch (error) {
            logger_1.default.error({ email, error: error instanceof Error ? error.message : 'Unknown error' }, '❌ Failed to send OTP email - will still allow signup');
            // Don't throw - allow signup to continue even if email fails
        }
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
    /**
     * OTP Email Template
     */
    static getOTPEmailTemplate(otp) {
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP Code</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
            text-align: center;
          }
          .otp-box {
            background: #f9fafb;
            border: 2px solid #dc2626;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 48px;
            font-weight: 700;
            color: #dc2626;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 0;
          }
          .otp-text {
            font-size: 14px;
            color: #666;
            margin-top: 12px;
          }
          .info {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
            text-align: left;
            font-size: 14px;
            color: #666;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎵 Maestera</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your OTP Code</p>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #1f2937;">Verify Your Email</h2>
            <p style="color: #666; margin-bottom: 24px;">
              Use the following one-time code to verify your email address and complete your signup.
            </p>
            
            <div class="otp-box">
              <p class="otp-code">${otp}</p>
              <p class="otp-text">This code expires in 10 minutes</p>
            </div>
            
            <div class="info">
              <strong>⏱️ Code Validity:</strong> This code is valid for 10 minutes only. If it expires, you can request a new one.
            </div>
            
            <div class="info">
              <strong>🔒 Security:</strong> Never share this code with anyone. Maestera staff will never ask for your OTP.
            </div>
            
            <p style="color: #999; font-size: 13px; margin-top: 32px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">© 2026 Maestera. All rights reserved.</p>
            <p style="margin: 8px 0 0 0;">
              Questions? <a href="mailto:support@maestera.com" style="color: #dc2626; text-decoration: none;">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    }
}
exports.OTPService = OTPService;
//# sourceMappingURL=otp.service.js.map