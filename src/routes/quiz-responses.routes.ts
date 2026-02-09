import { Router } from 'express'
import { QuizResponseController } from '../controllers/quiz-responses.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { apiLimiter } from '../middleware/rateLimiter'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Public route - submit quiz response (no auth required)
router.post(
  '/',
  apiLimiter,
  asyncHandler(QuizResponseController.submitQuizResponse)
)

// Admin routes
router.get(
  '/',
  apiLimiter,
  authenticateUser,
  requireRole('admin'),
  asyncHandler(QuizResponseController.getAllQuizResponses)
)

router.patch(
  '/:id',
  apiLimiter,
  authenticateUser,
  requireRole('admin'),
  asyncHandler(QuizResponseController.updateQuizResponse)
)

export default router
