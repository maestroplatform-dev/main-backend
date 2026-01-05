import { Response } from 'express'
import { AuthRequest } from '../types'
import { TeacherOnboardingService } from '../services/teacher-onboarding.service'
import { teacherCompleteOnboardingSchema } from '../utils/validation'
import logger from '../utils/logger'

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
}
