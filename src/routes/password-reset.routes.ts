import { Router } from 'express'
import { PasswordResetController } from '../controllers/password-reset.controller'
import { asyncHandler } from '../utils/asyncHandler'
import { authLimiter } from '../middleware/rateLimiter'

const router = Router()

// POST /api/v1/password-reset/send-otp - Send OTP to email
router.post('/send-otp', authLimiter, asyncHandler(PasswordResetController.sendResetOTP))

// POST /api/v1/password-reset/verify-and-reset - Verify OTP and reset password
router.post('/verify-and-reset', authLimiter, asyncHandler(PasswordResetController.verifyAndResetPassword))

export default router
