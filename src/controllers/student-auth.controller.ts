import { Request, Response, NextFunction } from 'express'
import { OTPService } from '../services/otp.service'
import { StudentService } from '../services/student.service'
import { PackageCardService } from '../services/package-card.service'
import { AppError } from '../types'
import logger from '../utils/logger'
import {
  studentSendOTPSchema,
  studentVerifyOTPSchema,
  studentResendOTPSchema,
  studentCompleteEmailSignupSchema,
  studentCompleteGoogleSignupSchema,
  studentUpdateProfilePictureSchema,
  studentUpdateProfileSchema,
  type StudentSendOTPInput,
  type StudentVerifyOTPInput,
  type StudentCompleteEmailSignupInput,
  type StudentCompleteGoogleSignupInput,
  type StudentUpdateProfilePictureInput,
  type StudentUpdateProfileInput,
} from '../utils/validation'

export class StudentAuthController {
  /**
   * POST /api/v1/auth/student/send-otp
   * Send OTP to student email
   */
  static async sendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = studentSendOTPSchema.parse(req.body) as StudentSendOTPInput

      // Generate and send OTP
      const { code } = await OTPService.generateAndSendOTP(email)

      // TODO: Send OTP via email service
      logger.info({ email }, '📧 OTP sent to email')

      res.json({
        success: true,
        message: 'OTP sent to your email. Valid for 10 minutes.',
        // Don't expose code in production
        ...(process.env.NODE_ENV === 'development' && { debug_code: code }),
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/auth/student/verify-otp
   * Verify OTP code
   */
  static async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp_code } = studentVerifyOTPSchema.parse(req.body) as StudentVerifyOTPInput

      // Verify OTP
      await OTPService.verifyOTP(email, otp_code)

      // Store verified email in session (frontend will handle session storage)
      res.json({
        success: true,
        message: 'OTP verified successfully',
        email,
        // In production, you might return a temporary token here
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/auth/student/resend-otp
   * Resend OTP to email
   */
  static async resendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = studentResendOTPSchema.parse(req.body) as StudentVerifyOTPInput

      // Resend OTP
      const { code } = await OTPService.resendOTP(email)

      logger.info({ email }, '📧 OTP resent to email')

      res.json({
        success: true,
        message: 'OTP resent to your email',
        ...(process.env.NODE_ENV === 'development' && { debug_code: code }),
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/auth/student/signup
   * Complete email signup - create user and student profile
   */
  static async completeEmailSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = studentCompleteEmailSignupSchema.parse(req.body) as StudentCompleteEmailSignupInput

      // Complete signup
      const result = await StudentService.completeEmailSignup({
        email: parsedData.email,
        name: parsedData.name,
        gender: parsedData.gender,
        dob: new Date(parsedData.date_of_birth),
        password: parsedData.password,
        guardianName: parsedData.guardian_name,
        guardianPhone: parsedData.guardian_phone,
      })

      logger.info({ userId: result.user.id, email: result.student }, '✅ Student signup completed')

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
          session: result.session
            ? {
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
                expires_in: result.session.expires_in,
              }
            : null,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/v1/auth/student/complete-profile-google
   * Complete Google OAuth signup - update user with profile info
   */
  static async completeGoogleSignup(req: Request, res: Response, next: NextFunction) {
    try {
      const parsedData = studentCompleteGoogleSignupSchema.parse(
        req.body
      ) as StudentCompleteGoogleSignupInput

      // Complete Google signup
      const result = await StudentService.completeGoogleSignup({
        userId: parsedData.user_id,
        dob: new Date(parsedData.date_of_birth),
        gender: parsedData.gender,
        googlePictureUrl: parsedData.google_picture_url,
        guardianName: parsedData.guardian_name,
        guardianPhone: parsedData.guardian_phone,
      })

      logger.info({ userId: result.user.id }, '✅ Google signup profile completed')

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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/student/profile
   * Get student profile (requires authentication)
   */
  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        throw new AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED')
      }

      const student = await StudentService.getStudentProfile(userId)

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
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/student/package-card
   * Get package card points for the student (requires authentication)
   */
  static async getPackageCard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        throw new AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED')
      }

      const card = await PackageCardService.getForStudent(userId)

      res.json({
        success: true,
        data: {
          package_card: card,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/v1/student/profile/picture
   * Update student profile picture (requires authentication)
   */
  static async updateProfilePicture(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        throw new AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED')
      }

      const { picture_url } = studentUpdateProfilePictureSchema.parse(
        req.body
      ) as StudentUpdateProfilePictureInput

      const student = await StudentService.updateProfilePicture(userId, picture_url)

      res.json({
        success: true,
        message: 'Profile picture updated successfully',
        data: {
          student: {
            id: student.id,
            profile_picture_url: student.profile_picture_url,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PATCH /api/v1/student/profile
   * Update student profile (requires authentication)
   */
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id

      if (!userId) {
        throw new AppError(401, 'User not authenticated', 'NOT_AUTHENTICATED')
      }

      const parsedData = studentUpdateProfileSchema.parse(req.body) as StudentUpdateProfileInput

      const student = await StudentService.updateStudentProfile(userId, {
        name: parsedData.name,
        gender: parsedData.gender,
        dateOfBirth: parsedData.date_of_birth ? new Date(parsedData.date_of_birth) : undefined,
        guardianName: parsedData.guardian_name,
        guardianPhone: parsedData.guardian_phone,
        profilePictureUrl: parsedData.profile_picture_url,
      })

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          student: {
            id: student.id,
            name: student.name,
            gender: student.gender,
            date_of_birth: student.date_of_birth,
            profile_picture_url: student.profile_picture_url,
            guardian_name: student.guardian_name,
            guardian_phone: student.guardian_phone,
            onboarding_status: student.onboarding_status,
            updated_at: student.updated_at,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/student/otp-remaining-time/:email
   * Get remaining time for OTP (development/debugging only)
   */
  static async getOTPRemainingTime(req: Request, res: Response, next: NextFunction) {
    try {
      if (process.env.NODE_ENV !== 'development') {
        throw new AppError(403, 'This endpoint is only available in development', 'FORBIDDEN')
      }

      const email = req.params.email as string
      const remaining = OTPService.getOTPRemainingTime(email)

      res.json({
        success: true,
        email,
        remaining_seconds: remaining,
      })
    } catch (error) {
      next(error)
    }
  }
}
