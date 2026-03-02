import { Router } from 'express'
import healthRoutes from './health.routes'
import testRoutes from './test.routes'
import authRoutes from './auth.routes'
import studentAuthRoutes from './student-auth.routes'
import studentPreferencesRoutes from './student-preferences.routes'
import teacherRoutes from './teachers.routes'
import adminRoutes from './admin.routes'
import bookingRoutes from './booking.routes'
import paymentRoutes from './payment.routes'
import featuredTeachersRoutes from './featured-teachers.routes'
import conversationRoutes from './conversation.routes'
import supportRoutes from './support.routes'
import quizResponseRoutes from './quiz-responses.routes'
import whatsappRoutes from './whatsapp.routes'
import { authenticateUser } from '../middleware/auth'

const router = Router()

// Health check routes (no versioning)
router.use(healthRoutes)

// Test routes
router.use(testRoutes)

// API v1 routes
router.use('/api/v1/auth', authRoutes)
router.use('/api/v1/auth/student', studentAuthRoutes)
router.use('/api/v1/student', authenticateUser, studentAuthRoutes)
router.use('/api/v1/student', studentPreferencesRoutes)
router.use('/api/v1/teachers', teacherRoutes)
router.use('/api/v1/admin', adminRoutes)
router.use('/api/v1/bookings', bookingRoutes)
router.use('/api/v1/payments', paymentRoutes)
router.use('/api/v1/featured-teachers', featuredTeachersRoutes)
router.use('/api/v1/conversations', conversationRoutes)
router.use('/api/v1/support', supportRoutes)
router.use('/api/v1/quiz-responses', quizResponseRoutes)
router.use('/api/v1/admin/quiz-responses', quizResponseRoutes)
router.use('/api/v1/whatsapp', whatsappRoutes)

export default router
