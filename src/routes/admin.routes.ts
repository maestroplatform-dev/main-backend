import { Router } from 'express'
import { AdminController } from '../controllers/admin.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { apiLimiter } from '../middleware/rateLimiter'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Dashboard statistics
router.get('/stats', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getDashboardStats))

// Teacher management
router.get('/teachers', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.listTeachers))
router.patch('/teachers/:id/verify', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.updateTeacherVerification))
router.post('/teachers/register', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.registerTeacher))

// User management
router.get('/users', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.listUsers))
router.patch('/users/:id/status', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.updateUserStatus))

// Audit logs
router.get('/audit-logs', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getAuditLogs))

export default router
