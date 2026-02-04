import { Router } from 'express'
import { FeaturedTeachersController } from '../controllers/featured-teachers.controller'
import { apiLimiter } from '../middleware/rateLimiter'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Public route - get featured teachers for homepage
router.get('/', apiLimiter, asyncHandler(FeaturedTeachersController.getFeaturedTeachers))

export default router
