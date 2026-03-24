import { Router } from 'express'
import { SupportController } from '../controllers/support.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { apiLimiter } from '../middleware/rateLimiter'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Student routes
router.post(
  '/tickets',
  apiLimiter,
  authenticateUser,
  requireRole('student'),
  asyncHandler(SupportController.createTicket)
)

router.get(
  '/tickets/my',
  apiLimiter,
  authenticateUser,
  requireRole('student'),
  asyncHandler(SupportController.getStudentTickets)
)

// Admin routes
router.get(
  '/tickets',
  apiLimiter,
  authenticateUser,
  requireRole('admin'),
  asyncHandler(SupportController.getAllTickets)
)

router.patch(
  '/tickets/:id',
  apiLimiter,
  authenticateUser,
  requireRole('admin'),
  asyncHandler(SupportController.updateTicket)
)

router.patch(
  '/tickets/:id/resolve-attendance-dispute',
  apiLimiter,
  authenticateUser,
  requireRole('admin'),
  asyncHandler(SupportController.resolveAttendanceDispute)
)

export default router
