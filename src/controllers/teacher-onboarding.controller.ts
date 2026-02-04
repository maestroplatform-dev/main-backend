import { Response } from 'express'
import { AuthRequest } from '../types'
import { TeacherOnboardingService } from '../services/teacher-onboarding.service'
import { teacherCompleteOnboardingSchema } from '../utils/validation'
import logger from '../utils/logger'
import { z } from 'zod'

// Validation schema for engagement preferences
const engagementPreferencesSchema = z.object({
  engagement_type: z.enum(['Teaching', 'Performance', 'Both']),
  collaborative_projects: z.array(z.string()).default([]),
  collaborative_other: z.string().optional(),
  class_formats: z.array(z.string()).optional(),
  class_formats_other: z.string().optional(),
  exam_training: z.array(z.string()).optional(),
  exam_training_other: z.string().optional(),
  additional_formats: z.array(z.string()).optional(),
  additional_formats_other: z.string().optional(),
  learner_groups: z.array(z.string()).optional(),
  learner_groups_other: z.string().optional(),
  performance_settings: z.array(z.string()).optional(),
  performance_settings_other: z.string().optional(),
  performance_fee_per_hour: z.number().optional(),
  other_contribution: z.string().optional(),
})

export class TeacherOnboardingController {
  // POST /api/v1/teachers/onboarding - Complete onboarding with all data
  static async completeOnboarding(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Completing teacher onboarding...')

    const data = teacherCompleteOnboardingSchema.parse(req.body)
    const result = await TeacherOnboardingService.completeOnboarding(req.user!.id, data)

    logger.info({ userId: req.user?.id }, '✅ Teacher onboarding completed successfully')

    res.status(201).json({
      success: true,
      data: {
        message: 'Onboarding completed successfully',
        teacher: result,
      },
    })
  }

  // GET /api/v1/teachers/onboarding - Fetch full onboarding data
  static async getOnboardingData(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Fetching onboarding data')

    const result = await TeacherOnboardingService.getOnboardingData(req.user!.id)

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  // POST /api/v1/teachers/engagement-preferences - Save engagement preferences only
  static async saveEngagementPreferences(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Saving engagement preferences...')

    const data = engagementPreferencesSchema.parse(req.body)
    const result = await TeacherOnboardingService.saveEngagementPreferences(req.user!.id, data)

    logger.info({ userId: req.user?.id }, '✅ Engagement preferences saved successfully')

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  // GET /api/v1/teachers/engagement-preferences - Get engagement preferences
  static async getEngagementPreferences(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Fetching engagement preferences')

    const result = await TeacherOnboardingService.getEngagementPreferences(req.user!.id)

    res.status(200).json({
      success: true,
      data: result,
    })
  }
}
