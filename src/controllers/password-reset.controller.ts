import { Request, Response } from 'express'
import { PasswordResetService } from '../services/password-reset.service'

export class PasswordResetController {
  /**
   * POST /api/v1/password-reset/send-otp
   * Send OTP to email
   */
  static async sendResetOTP(req: Request, res: Response): Promise<void> {
    const { email } = req.body

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    try {
      await PasswordResetService.generateAndSendPasswordResetOTP(email)
      res.status(200).json({
        message: 'If an account exists with this email, a reset OTP has been sent.',
        success: true,
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * POST /api/v1/password-reset/verify-and-reset
   * Verify OTP and reset password in one step
   */
  static async verifyAndResetPassword(req: Request, res: Response): Promise<void> {
    const { email, otp, newPassword } = req.body

    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: 'Email, OTP, and new password are required' })
      return
    }

    try {
      await PasswordResetService.verifyOtpAndResetPassword(email, otp, newPassword)
      res.status(200).json({
        message: 'Password reset successfully',
        success: true,
      })
    } catch (error) {
      throw error
    }
  }
}
