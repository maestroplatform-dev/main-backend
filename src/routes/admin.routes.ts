import { Router } from 'express'
import { AdminController } from '../controllers/admin.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// GET /api/v1/admin/profiles - list profiles (admin only)
router.get('/profiles', authenticateUser, requireRole('admin'), asyncHandler(AdminController.listProfiles))

// GET /api/v1/admin/teachers - list all teachers with onboarding data
router.get('/teachers', authenticateUser, requireRole('admin'), asyncHandler(AdminController.listTeachers))

// GET /api/v1/admin/teachers/:id - get single teacher details
router.get('/teachers/:id', authenticateUser, requireRole('admin'), asyncHandler(AdminController.getTeacherDetails))

export default router
