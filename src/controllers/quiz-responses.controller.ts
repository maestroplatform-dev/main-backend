import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest, AppError } from '../types'
import { z } from 'zod'
import logger from '../utils/logger'

const quizResponseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be a valid 10-digit number'),
  instruments: z.array(z.string()).default([]),
  learning_mode: z.enum(['online', 'offline', 'both']).default('both'),
  pincode: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  budget_min: z.number().int().optional().nullable(),
  budget_max: z.number().int().optional().nullable(),
  learning_goals: z.array(z.string()).default([]),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
})

export class QuizResponseController {
  /**
   * POST /api/v1/quiz-responses
   * Public endpoint - submit quiz response (no auth required)
   */
  static async submitQuizResponse(req: any, res: Response) {
    try {
      const parsed = quizResponseSchema.parse(req.body)

      const response = await prisma.quiz_responses.create({
        data: {
          name: parsed.name,
          phone: parsed.phone,
          instruments: parsed.instruments,
          learning_mode: parsed.learning_mode,
          pincode: parsed.pincode || null,
          city: parsed.city || null,
          budget_min: parsed.budget_min || null,
          budget_max: parsed.budget_max || null,
          learning_goals: parsed.learning_goals,
          skill_level: parsed.skill_level,
        },
      })

      logger.info({ phoneNumber: parsed.phone }, '✅ Quiz response submitted')

      res.status(201).json({
        success: true,
        message: 'Quiz response saved successfully',
        data: { response },
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
      logger.error({ error }, 'Failed to save quiz response')
      res.status(500).json({
        success: false,
        message: 'Failed to save quiz response',
      })
    }
  }

  /**
   * GET /api/v1/admin/quiz-responses
   * Admin only - get all quiz responses
   */
  static async getAllQuizResponses(req: AuthRequest, res: Response) {
    try {
      const { page = '1', limit = '20', contacted } = req.query

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20))
      const skip = (pageNum - 1) * limitNum

      const where: any = {}
      if (contacted === 'true') {
        where.contacted = true
      } else if (contacted === 'false') {
        where.contacted = false
      }

      const [responses, total] = await Promise.all([
        prisma.quiz_responses.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.quiz_responses.count({ where }),
      ])

      res.json({
        success: true,
        data: { responses },
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      })
    } catch (error) {
      logger.error({ error }, 'Failed to fetch quiz responses')
      res.status(500).json({
        success: false,
        message: 'Failed to fetch quiz responses',
      })
    }
  }

  /**
   * PATCH /api/v1/admin/quiz-responses/:id
   * Admin only - mark as contacted or add notes
   */
  static async updateQuizResponse(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { contacted, admin_notes } = req.body

      const existing = await prisma.quiz_responses.findUnique({ where: { id } })
      if (!existing) {
        throw new AppError(404, 'Quiz response not found', 'NOT_FOUND')
      }

      const updateData: any = {}
      if (contacted !== undefined) updateData.contacted = contacted
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes

      const response = await prisma.quiz_responses.update({
        where: { id },
        data: updateData,
      })

      res.json({
        success: true,
        data: { response },
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error({ error }, 'Failed to update quiz response')
      res.status(500).json({
        success: false,
        message: 'Failed to update quiz response',
      })
    }
  }
}
