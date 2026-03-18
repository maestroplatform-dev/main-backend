import { Request, Response } from 'express'
import { AuthRequest } from '../types'
import { AppError } from '../types'
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

const processBackgroundSchema = z.object({
  inputType: z.enum(['resume', 'text']),
  resumeUrl: z.string().url().optional(),
  aboutText: z.string().min(10).optional(),
}).refine((data) => {
  if (data.inputType === 'resume') return Boolean(data.resumeUrl)
  return Boolean(data.aboutText)
}, {
  message: 'Provide resumeUrl for resume mode or aboutText for text mode',
})

const n8nCallbackSchema = z.object({
  teacherId: z.string().uuid(),
  aboutMe: z.string().optional(),
  tagline: z.string().optional(),
  teachingStyle: z.string().optional(),
  educationalBackground: z.string().optional(),
  professionalExperience: z.string().optional(),
})

export class TeacherOnboardingController {
  // POST /api/v1/teachers/onboarding - Complete onboarding with all data
  static async completeOnboarding(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Completing teacher onboarding...')

    const data = teacherCompleteOnboardingSchema.parse(req.body)
    const result = await TeacherOnboardingService.completeOnboarding(req.user!.id, data)

    logger.info({ userId: req.user?.id }, '✅ Teacher onboarding completed successfully')

    // Send welcome email (fire-and-forget)
    void TeacherOnboardingService.sendWelcomeEmail(req.user!.id)

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

  // POST /api/v1/teachers/onboarding/process-background
  static async processBackground(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Processing onboarding background input')

    const data = processBackgroundSchema.parse(req.body)
    const result = await TeacherOnboardingService.processBackground(req.user!.id, data)

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  // POST /api/v1/teachers/onboarding/n8n-callback
  static async handleN8nCallback(req: Request, res: Response) {
    const expectedSecret = process.env.N8N_CALLBACK_SECRET
    if (expectedSecret) {
      const authHeader = String(req.headers.authorization || '')
      const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : ''
      const headerToken = String(req.headers['x-n8n-secret'] || '').trim()
      const provided = bearerToken || headerToken

      if (!provided || provided !== expectedSecret) {
        throw new AppError(401, 'Unauthorized callback', 'UNAUTHORIZED_CALLBACK')
      }
    }

    const data = n8nCallbackSchema.parse(req.body)
    const result = await TeacherOnboardingService.applyN8nProfileExtraction(data)

    res.status(200).json({
      success: true,
      data: result,
    })
  }
}
