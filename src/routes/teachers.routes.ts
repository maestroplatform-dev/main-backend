import { Router } from 'express'
import { TeacherController } from '../controllers/teacher.controller'
import { TeacherOnboardingController } from '../controllers/teacher-onboarding.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Protected routes (require authentication + teacher role)
// Specific routes must come BEFORE dynamic :id routes

// Onboarding endpoints (specific routes first)
router.post(
  '/onboarding',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.completeOnboarding)
)

router.get(
  '/onboarding',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.getOnboardingData)
)

// Old onboarding route (kept for compatibility)
router.post(
  '/onboard',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.onboard)
)

// Profile routes
router.get(
  '/profile/me',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getOwnProfile)
)

router.put(
  '/profile',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.updateProfile)
)

// Public routes (must come LAST - after all protected routes)
router.get('/', asyncHandler(TeacherController.getAllTeachers))
router.get('/:id', asyncHandler(TeacherController.getTeacherById))

export default router
