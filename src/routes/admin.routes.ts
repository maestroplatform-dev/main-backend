import { Router } from 'express'
import { AdminController } from '../controllers/admin.controller'
import { FeaturedTeachersController } from '../controllers/featured-teachers.controller'
import { SectionReviewController } from '../controllers/section-review.controller'
import { SpecificPoliciesController } from '../controllers/specific-policies.controller'
import { authenticateUser, requireRole } from '../middleware/auth'
import { apiLimiter } from '../middleware/rateLimiter'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Dashboard statistics
router.get('/stats', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getDashboardStats))

// Financial tracking
router.get('/payments', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getPaymentStats))
router.get('/earnings', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getTeacherEarnings))

// Teacher management
router.get('/teachers', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.listTeachers))
router.get('/teachers/:id/onboarding', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getTeacherOnboardingData))
router.get('/teachers/:id/bank-details', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getTeacherBankDetails))
router.get('/teachers/:id', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getTeacherDetails))
router.put('/teachers/:id', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.updateTeacherDetails))
router.patch('/teachers/:id/verify', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.updateTeacherVerification))
router.post('/teachers/register', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.registerTeacher))

// Section-level review routes (admin)
router.get('/section-reviews/pending', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(SectionReviewController.getPendingReviews))
router.post('/section-reviews/:reviewId/action', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(SectionReviewController.reviewSection))

// Teacher specific policies (admin view)
router.get('/teachers/:teacherId/specific-policies', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(SpecificPoliciesController.adminGetTeacherPolicies))

// User management
router.get('/users', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.listUsers))
router.patch('/users/:id/status', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.updateUserStatus))

// Package card configuration
router.get(
	'/package-card-templates',
	apiLimiter,
	authenticateUser,
	requireRole('admin'),
	asyncHandler(AdminController.listPackageCardTemplates)
)

router.put(
	'/package-card-templates/:level',
	apiLimiter,
	authenticateUser,
	requireRole('admin'),
	asyncHandler(AdminController.upsertPackageCardTemplate)
)

router.put(
	'/students/:id/package-card',
	apiLimiter,
	authenticateUser,
	requireRole('admin'),
	asyncHandler(AdminController.updateStudentPackageCard)
)

// Audit logs
router.get('/audit-logs', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(AdminController.getAuditLogs))

// Featured teachers management
router.get('/featured-teachers', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(FeaturedTeachersController.getAdminFeaturedTeachers))
router.put('/featured-teachers', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(FeaturedTeachersController.setFeaturedTeachers))
router.post('/featured-teachers', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(FeaturedTeachersController.addFeaturedTeacher))
router.delete('/featured-teachers/:teacherId', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(FeaturedTeachersController.removeFeaturedTeacher))
router.patch('/featured-teachers/order', apiLimiter, authenticateUser, requireRole('admin'), asyncHandler(FeaturedTeachersController.updateDisplayOrder))

export default router
