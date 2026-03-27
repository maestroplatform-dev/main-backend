import { Router } from 'express'
import { TeacherController } from '../controllers/teacher.controller'
import { TeacherOnboardingController } from '../controllers/teacher-onboarding.controller'
import { TeacherAvailabilityController } from '../controllers/teacher-availability.controller'
import { SectionReviewController } from '../controllers/section-review.controller'
import { SpecificPoliciesController } from '../controllers/specific-policies.controller'
import { NotificationController } from '../controllers/notification.controller'
import { bookingController } from '../controllers/booking.controller'
import { authenticateTeacherUser, authenticateUser, requireRole } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Protected routes (require authentication + teacher role)
// Specific routes must come BEFORE dynamic :id routes

// Onboarding endpoints (specific routes first)
router.post(
  '/onboarding',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.completeOnboarding)
)

router.get(
  '/onboarding',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.getOnboardingData)
)

router.post(
  '/onboarding/process-background',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.processBackground)
)

router.post(
  '/onboarding/n8n-callback',
  asyncHandler(TeacherOnboardingController.handleN8nCallback)
)

// Engagement preferences endpoints
router.post(
  '/engagement-preferences',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.saveEngagementPreferences)
)

router.get(
  '/engagement-preferences',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherOnboardingController.getEngagementPreferences)
)

// Old onboarding route (kept for compatibility)
router.post(
  '/onboard',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.onboard)
)

// Profile routes
router.get(
  '/profile/me',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getOwnProfile)
)

router.put(
  '/profile',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.updateProfile)
)

router.patch(
  '/profile/me',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.updateProfile)
)

// Bank details routes
router.get(
  '/bank-details',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getBankDetails)
)

router.get(
  '/earnings',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getEarnings)
)

router.post(
  '/bank-details',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.saveBankDetails)
)

router.put(
  '/bank-details',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.saveBankDetails)
)

// Instrument/Pricing routes
router.get(
  '/instruments',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getInstruments)
)

router.post(
  '/instruments',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.createInstrument)
)

router.post(
  '/instruments/generate-pointers',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.generateInstrumentPointers)
)

router.get(
  '/instruments/pointer-status/:requestId',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getInstrumentPointerStatus)
)

router.post(
  '/instruments/pointer-callback',
  asyncHandler(TeacherController.handleInstrumentPointerCallback)
)

router.put(
  '/instruments/:id',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.updateInstrument)
)

router.delete(
  '/instruments/:id',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.deleteInstrument)
)

// Profile completion and review routes
router.get(
  '/profile-completion',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherController.getProfileCompletionStatus)
)

// Section review routes
router.get(
  '/section-reviews',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SectionReviewController.getAllStatuses)
)

router.get(
  '/section-reviews/:section',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SectionReviewController.getSectionStatus)
)

router.post(
  '/section-reviews/:section/submit',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SectionReviewController.submitForReview)
)

// Specific policies routes
router.get(
  '/specific-policies',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SpecificPoliciesController.getSpecificPolicies)
)

router.put(
  '/specific-policies',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SpecificPoliciesController.saveSpecificPolicies)
)

router.post(
  '/specific-policies/submit',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SpecificPoliciesController.submitForReview)
)

router.get(
  '/specific-policies/review-status',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(SpecificPoliciesController.getReviewStatus)
)

// Notification routes
router.get(
  '/notifications',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(NotificationController.getNotifications)
)

router.get(
  '/notifications/unread-count',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(NotificationController.getUnreadCount)
)

router.patch(
  '/notifications/read-all',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(NotificationController.markAllAsRead)
)

router.patch(
  '/notifications/:id/read',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(NotificationController.markAsRead)
)

// ============================================================
// AVAILABILITY ROUTES (Teacher authenticated)
// All date-based - no weekly recurring logic
// ============================================================

// Add a single slot for a specific date
router.post(
  '/availability/slot',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.addSlot)
)

// Add multiple slots at once
router.post(
  '/availability/slots',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.addBulkSlots)
)

// Replace all slots for a specific date
router.put(
  '/availability/date',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.replaceSlotsForDate)
)

// Get own slots (with optional date range query params)
router.get(
  '/availability/me',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.getMySlots)
)

// Unavailable dates management (must come BEFORE /:id routes)
router.post(
  '/availability/unavailable',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.markUnavailable)
)

router.get(
  '/availability/unavailable',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.getUnavailableDates)
)

router.delete(
  '/availability/unavailable/:date',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.removeUnavailable)
)

// Delete all slots for a specific date
router.delete(
  '/availability/date/:date',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.deleteSlotsForDate)
)

// Calendar view (availability + bookings)
router.get(
  '/calendar',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.getCalendar)
)

// Single slot operations (parameterized routes come LAST)
router.get(
  '/availability/:id',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.getSlot)
)

router.put(
  '/availability/:id',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.updateSlot)
)

router.delete(
  '/availability/:id',
  authenticateTeacherUser,
  requireRole('teacher'),
  asyncHandler(TeacherAvailabilityController.deleteSlot)
)

// ============================================================
// PUBLIC ROUTES (must come LAST - after all protected routes)
// ============================================================

// Public availability for booking (filters out already-booked slots)
router.get(
  '/:teacherId/public-availability',
  authenticateUser,
  asyncHandler(bookingController.getPublicAvailability.bind(bookingController))
)

// Available slots for students (public - any authenticated user)
router.get(
  '/:teacherId/available-slots',
  authenticateUser,
  asyncHandler(TeacherAvailabilityController.getAvailableSlots)
)

// Unavailable dates for students (public - any authenticated user)
router.get(
  '/:teacherId/unavailable-dates',
  authenticateUser,
  asyncHandler(TeacherAvailabilityController.getPublicUnavailableDates)
)

router.get('/', asyncHandler(TeacherController.getAllTeachers))
router.get('/:id', asyncHandler(TeacherController.getTeacherById))

export default router
