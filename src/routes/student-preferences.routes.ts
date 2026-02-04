import { Router } from 'express'
import { StudentPreferencesController } from '../controllers/student-preferences.controller'
import { authenticateUser } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authenticateUser)

// Save quiz preferences
router.post('/preferences', StudentPreferencesController.savePreferences)

// Get quiz preferences
router.get('/preferences', StudentPreferencesController.getPreferences)

// Check quiz completion status
router.get('/preferences/status', StudentPreferencesController.getQuizStatus)

// Get preferences as search filters
router.get('/preferences/filters', StudentPreferencesController.getSearchFilters)

export default router
