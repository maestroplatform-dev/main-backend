import { Router } from 'express'
import { TeacherController } from '../controllers/teacher.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Public routes
router.get('/', asyncHandler(TeacherController.getAllTeachers))
router.get('/:id', asyncHandler(TeacherController.getTeacherById))

// Protected routes (require authentication)
router.post(
  '/onboard',
  authenticateUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.onboard)
)

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

export default router
