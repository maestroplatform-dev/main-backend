import { Router } from 'express'
import healthRoutes from './health.routes'
import testRoutes from './test.routes'
import authRoutes from './auth.routes'
import studentAuthRoutes from './student-auth.routes'
import teacherRoutes from './teachers.routes'
import adminRoutes from './admin.routes'
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
router.use('/api/v1/teachers', teacherRoutes)
router.use('/api/v1/admin', adminRoutes)

export default router
