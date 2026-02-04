import { Response, NextFunction } from 'express'
import { StudentPreferencesService } from '../services/student-preferences.service'
import { AppError, AuthRequest } from '../types'
import logger from '../utils/logger'
import { z } from 'zod'

// Validation schema for quiz preferences
const preferencesSchema = z.object({
  instruments: z.array(z.string()).min(1, 'At least one instrument is required'),
  learning_mode: z.enum(['online', 'offline', 'both']),
  location: z.string().optional().nullable(),
  budget_min: z.number().int().positive().optional().nullable(),
  budget_max: z.number().int().positive().optional().nullable(),
  learning_goals: z.array(z.string()).default([]),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
})

export class StudentPreferencesController {
  /**
   * POST /api/v1/student/preferences
   * Save student quiz preferences
   */
  static async savePreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED')
      }

      const parsed = preferencesSchema.parse(req.body)

      // Validate location is provided for offline/both modes
      if ((parsed.learning_mode === 'offline' || parsed.learning_mode === 'both') && !parsed.location) {
        throw new AppError(400, 'Location is required for offline or hybrid learning mode', 'LOCATION_REQUIRED')
      }

      const preferences = await StudentPreferencesService.savePreferences(userId, {
        instruments: parsed.instruments,
        learning_mode: parsed.learning_mode,
        location: parsed.location ?? undefined,
        budget_min: parsed.budget_min ?? undefined,
        budget_max: parsed.budget_max ?? undefined,
        learning_goals: parsed.learning_goals,
        skill_level: parsed.skill_level,
      })

      logger.info({ userId }, '✅ Quiz preferences saved')

      res.json({
        success: true,
        message: 'Preferences saved successfully',
        data: {
          preferences: {
            id: preferences.id,
            instruments: preferences.instruments,
            learning_mode: preferences.learning_mode,
            location: preferences.location,
            budget_min: preferences.budget_min,
            budget_max: preferences.budget_max,
            learning_goals: preferences.learning_goals,
            skill_level: preferences.skill_level,
            quiz_completed: preferences.quiz_completed,
          },
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.issues,
        })
        return
      }
      next(error)
    }
  }

  /**
   * GET /api/v1/student/preferences
   * Get student quiz preferences
   */
  static async getPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED')
      }

      const preferences = await StudentPreferencesService.getPreferences(userId)

      res.json({
        success: true,
        data: {
          preferences: preferences
            ? {
                id: preferences.id,
                instruments: preferences.instruments,
                learning_mode: preferences.learning_mode,
                location: preferences.location,
                budget_min: preferences.budget_min,
                budget_max: preferences.budget_max,
                learning_goals: preferences.learning_goals,
                skill_level: preferences.skill_level,
                quiz_completed: preferences.quiz_completed,
              }
            : null,
          quiz_completed: preferences?.quiz_completed ?? false,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/student/preferences/status
   * Check if student has completed the quiz
   */
  static async getQuizStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED')
      }

      const completed = await StudentPreferencesService.hasCompletedQuiz(userId)

      res.json({
        success: true,
        data: {
          quiz_completed: completed,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/student/preferences/filters
   * Get preferences as search filters
   */
  static async getSearchFilters(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError(401, 'Authentication required', 'UNAUTHORIZED')
      }

      const filters = await StudentPreferencesService.getSearchFilters(userId)

      res.json({
        success: true,
        data: {
          filters,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
