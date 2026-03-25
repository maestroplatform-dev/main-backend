import prisma from '../config/database'
import { AppError } from '../types'
import logger from '../utils/logger'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@maestera.com'

const OTP_EXPIRY_MINUTES = 10
const OTP_LENGTH = 6
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_SECONDS = 30

export class PasswordResetService {
  /**
   * Generate secure OTP hash
   */
  private static generateOtpHash(email: string, otp: string): string {
    const secret = process.env.OTP_SECRET || 'default-secret'
    return crypto
      .createHmac('sha256', secret)
      .update(`${email}.${otp}`)
      .digest('hex')
  }

  /**
   * Generate 6-digit OTP
   */
  private static generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Send password reset OTP via email
   */
  static async generateAndSendPasswordResetOTP(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const existingUser = await prisma.users.findFirst({
      where: { email: normalizedEmail },
    })

    if (!existingUser) {
      // For security, don't reveal if email exists
      logger.warn({ email: normalizedEmail }, 'Password reset requested for non-existent email')
      return
    }

    // Check for recent OTP (prevent spam)
    const recentOtp = await prisma.password_reset_otps.findFirst({
      where: {
        email: normalizedEmail,
        status: 'pending',
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    })

    if (recentOtp) {
      const secondsSinceCreation = (Date.now() - recentOtp.created_at.getTime()) / 1000
      if (secondsSinceCreation < RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceCreation)
        throw new AppError(
          429,
          `Please wait ${remaining}s before requesting another OTP`,
          'OTP_RECENTLY_SENT'
        )
      }
    }

    // Generate OTP
    const otp = this.generateOtp()
    const otpHash = this.generateOtpHash(normalizedEmail, otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Store in database
    const resetRecord = await prisma.password_reset_otps.create({
      data: {
        email: normalizedEmail,
        otp_code: otp,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        status: 'pending',
      },
    })

    logger.info({ email: normalizedEmail, resetId: resetRecord.id }, 'Password reset OTP generated')

    // Send email
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: normalizedEmail,
        subject: '🎵 Your Maestera Password Reset Code',
        html: this.getPasswordResetEmailTemplate(otp),
      })
      logger.info({ email: normalizedEmail }, 'Password reset OTP email sent')
    } catch (error) {
      logger.error(
        { email: normalizedEmail, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to send password reset email'
      )
      throw new AppError(500, 'Failed to send OTP email', 'EMAIL_SEND_FAILED')
    }
  }

  /**
   * Verify OTP and reset password in one step
   */
  static async verifyOtpAndResetPassword(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim()

    if (!newPassword || newPassword.length < 6) {
      throw new AppError(400, 'Password must be at least 6 characters', 'PASSWORD_INVALID')
    }

    // Find OTP record
    const resetRecord = await prisma.password_reset_otps.findFirst({
      where: {
        email: normalizedEmail,
        status: 'pending',
      },
      orderBy: { created_at: 'desc' },
    })

    if (!resetRecord) {
      throw new AppError(400, 'No reset request found. Please request a new OTP.', 'OTP_NOT_FOUND')
    }

    // Check if expired
    if (new Date() > resetRecord.expires_at) {
      await prisma.password_reset_otps.update({
        where: { id: resetRecord.id },
        data: { status: 'expired' },
      })
      throw new AppError(400, 'OTP has expired. Please request a new one.', 'OTP_EXPIRED')
    }

    // Check attempts
    if (resetRecord.attempts >= MAX_ATTEMPTS) {
      await prisma.password_reset_otps.update({
        where: { id: resetRecord.id },
        data: { status: 'blocked' },
      })
      throw new AppError(429, 'Too many failed attempts. Please request a new OTP.', 'OTP_MAX_ATTEMPTS')
    }

    // Verify OTP
    const computedHash = this.generateOtpHash(normalizedEmail, otp.trim())
    if (computedHash !== resetRecord.otp_hash) {
      await prisma.password_reset_otps.update({
        where: { id: resetRecord.id },
        data: { attempts: resetRecord.attempts + 1 },
      })
      throw new AppError(400, 'Invalid OTP code', 'OTP_INVALID')
    }

    // Mark as verified
    await prisma.password_reset_otps.update({
      where: { id: resetRecord.id },
      data: {
        verified_at: new Date(),
        status: 'verified',
      },
    })

    // Update user password via Supabase
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    try {
      // Get user by email from users table to find their Supabase UUID
      const user = await prisma.users.findFirst({
        where: { email: normalizedEmail },
      })

      if (!user) {
        throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
      }

      // Update password in Supabase
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      })

      if (updateError) {
        throw new AppError(500, updateError.message, 'PASSWORD_UPDATE_FAILED')
      }

      logger.info({ email: normalizedEmail }, 'Password reset successfully')
    } catch (error) {
      logger.error(
        { email: normalizedEmail, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to update password'
      )
      throw error
    }
  }

  /**
   * Clean up expired OTP records (run periodically)
   */
  static async cleanupExpiredOTPs(): Promise<void> {
    const result = await prisma.password_reset_otps.deleteMany({
      where: {
        expires_at: { lt: new Date() },
        status: { in: ['pending', 'expired', 'blocked'] },
      },
    })

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up expired password reset OTPs')
    }
  }

  /**
   * Email template for password reset OTP
   */
  private static getPasswordResetEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DA2D2C; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp { font-size: 32px; font-weight: bold; letter-spacing: 2px; color: #DA2D2C; text-align: center; margin: 20px 0; font-family: 'Courier New', monospace; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
          .warning { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 15px 0; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🎵 Maestera</h1>
            <p style="margin: 5px 0 0 0;">Password Reset</p>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p>We received a request to reset your Maestera password. Use the code below to proceed:</p>
            
            <div class="otp">${otp}</div>
            
            <p style="text-align: center; color: #666; font-size: 14px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes</p>
            
            <div class="warning">
              ⚠️ <strong>Never share this code with anyone.</strong> Maestera staff will never ask for it.
            </div>
            
            <p style="margin-top: 30px; font-size: 13px; color: #999;">
              If you didn't request this, you can safely ignore this email. Your account is secure.
            </p>
          </div>
          <div class="footer">
            <p>© 2026 Maestera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}
