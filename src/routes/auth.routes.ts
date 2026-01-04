import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { authenticateUser, validateSupabaseToken } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'
import { authLimiter } from '../middleware/rateLimiter'

const router = Router()

// POST /api/v1/auth/register - Create profile after Supabase signup (token only, no profile required)
router.post('/register', authLimiter, validateSupabaseToken, asyncHandler(AuthController.register))

// GET /api/v1/auth/me - Get current user (requires profile)
router.get('/me', authLimiter, authenticateUser, asyncHandler(AuthController.getCurrentUser))

export default router
