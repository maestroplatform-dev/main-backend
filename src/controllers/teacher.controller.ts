import { Request, Response } from 'express'
import { AuthRequest } from '../types'
import { TeacherService } from '../services/teacher.service'
import { teacherOnboardingSchema, teacherProfileUpdateSchema } from '../utils/validation'
import { AppError } from '../types'
import { z } from 'zod'

const generatePointersSchema = z.object({
  instrument_name: z.string().trim().min(1),
  teach_or_perform: z.enum(['teach', 'perform']).default('teach'),
  class_mode: z.enum(['online', 'offline']).optional(),
  pricing: z.object({
    beginner: z.number().nonnegative(),
    intermediate: z.number().nonnegative(),
    advanced: z.number().nonnegative(),
  }),
})

const normalizePointerCallbackBody = (rawBody: unknown) => {
  const top = Array.isArray(rawBody) ? rawBody[0] : rawBody
  const topRecord = top && typeof top === 'object' ? (top as Record<string, unknown>) : {}
  const output = topRecord.output && typeof topRecord.output === 'object'
    ? (topRecord.output as Record<string, unknown>)
    : {}

  return {
    request_id: topRecord.request_id ?? topRecord.requestId ?? output.request_id ?? output.requestId,
    teacher_id: topRecord.teacher_id ?? topRecord.teacherId ?? output.teacher_id ?? output.teacherId,
    package_card_points:
      topRecord.package_card_points
      ?? topRecord.packageCardPoints
      ?? output.package_card_points
      ?? output.packageCardPoints,
    error: topRecord.error ?? output.error,
  }
}

const pointerCallbackSchema = z.object({
  request_id: z.string().trim().min(1).optional(),
  teacher_id: z.string().uuid().optional(),
  package_card_points: z.unknown().optional(),
  error: z.string().optional(),
}).refine((data) => Boolean(data.request_id), {
  message: 'request_id is required (send it at top-level or inside output)',
}).refine((data) => Boolean(data.error) || data.package_card_points !== undefined, {
  message: 'Either package_card_points or error is required',
})

export class TeacherController {
  // POST /api/v1/teachers/onboard
  static async onboard(req: AuthRequest, res: Response) {
    const data = teacherOnboardingSchema.parse(req.body)
    
    const teacher = await TeacherService.onboard(req.user!.id, data)

    res.status(201).json({
      success: true,
      data: {
        message: 'Teacher onboarding completed',
        teacher,
      },
    })
  }

  // GET /api/v1/teachers/profile (own profile)
  static async getOwnProfile(req: AuthRequest, res: Response) {
    const teacher = await TeacherService.getProfile(req.user!.id)

    res.json({
      success: true,
      data: teacher,
    })
  }

  // GET /api/v1/teachers/:id (public)
  static async getTeacherById(req: Request, res: Response) {
    const teacher = await TeacherService.getProfile(req.params.id as string)

    res.json({
      success: true,
      data: teacher,
    })
  }

  // PUT /api/v1/teachers/profile
  static async updateProfile(req: AuthRequest, res: Response) {
    const data = teacherProfileUpdateSchema.parse(req.body)
    
    const teacher = await TeacherService.updateProfile(req.user!.id, data)

    res.json({
      success: true,
      data: {
        message: 'Profile updated successfully',
        teacher,
      },
    })
  }

  // GET /api/v1/teachers (public - list all with search/filter/sort)
  static async getAllTeachers(req: Request, res: Response) {
    const verified = req.query.verified === 'true'
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0
    const search = (req.query.search as string) || ''
    const instrument = (req.query.instrument as string) || ''
    const city = (req.query.city as string) || ''
    const level = (req.query.level as string) || ''
    const mode = (req.query.mode as string) || ''
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined
    const sortBy = (req.query.sortBy as string) || 'az'

    const { teachers, total } = await TeacherService.getAllTeachers({
      verified,
      limit,
      offset,
      search: search || undefined,
      instrument: instrument || undefined,
      city: city || undefined,
      level: level || undefined,
      mode: mode || undefined,
      minPrice,
      maxPrice,
      sortBy,
    })

    res.json({
      success: true,
      data: teachers,
      meta: {
        limit,
        offset,
        total,
      },
    })
  }

  // GET /api/v1/teachers/bank-details
  static async getBankDetails(req: AuthRequest, res: Response) {
    const bankDetails = await TeacherService.getBankDetails(req.user!.id)

    res.json({
      success: true,
      data: bankDetails,
    })
  }

  // GET /api/v1/teachers/earnings
  static async getEarnings(req: AuthRequest, res: Response) {
    const earnings = await TeacherService.getEarningsOverview(req.user!.id)

    res.json({
      success: true,
      data: earnings,
    })
  }

  // POST/PUT /api/v1/teachers/bank-details
  static async saveBankDetails(req: AuthRequest, res: Response) {
    const { bank_name, account_holder_name, account_number, gst_number, ifsc_code } = req.body

    if (!bank_name || !account_holder_name || !account_number) {
      res.status(400).json({
        success: false,
        error: 'bank_name, account_holder_name, and account_number are required',
      })
      return
    }

    const bankDetails = await TeacherService.saveBankDetails(req.user!.id, {
      bank_name,
      account_holder_name,
      account_number,
      gst_number: gst_number || null,
      ifsc_code: ifsc_code || null,
    })

    res.json({
      success: true,
      data: bankDetails,
      message: 'Bank details saved successfully',
    })
  }

  // GET /api/v1/teachers/instruments
  static async getInstruments(req: AuthRequest, res: Response) {
    const instruments = await TeacherService.getInstruments(req.user!.id)

    res.json({
      success: true,
      data: instruments,
    })
  }

  // POST /api/v1/teachers/instruments
  static async createInstrument(req: AuthRequest, res: Response) {
    const { instrument, teach_or_perform, class_mode, base_price, performance_fee_inr, open_to_international, international_premium, tiers, package_card_points } = req.body

    if (!instrument || !teach_or_perform) {
      res.status(400).json({
        success: false,
        error: 'instrument and teach_or_perform are required',
      })
      return
    }

    const result = await TeacherService.createInstrument(req.user!.id, {
      instrument,
      teach_or_perform,
      class_mode,
      base_price,
      performance_fee_inr,
      open_to_international,
      international_premium,
      tiers,
      package_card_points,
    })

    res.status(201).json({
      success: true,
      data: result,
      message: 'Instrument created successfully',
    })
  }

  // PUT /api/v1/teachers/instruments/:id
  static async updateInstrument(req: AuthRequest, res: Response) {
    const id = req.params.id as string
    const { instrument, teach_or_perform, class_mode, base_price, performance_fee_inr, open_to_international, international_premium, tiers, package_card_points } = req.body

    const result = await TeacherService.updateInstrument(req.user!.id, id, {
      instrument,
      teach_or_perform,
      class_mode,
      base_price,
      performance_fee_inr,
      open_to_international,
      international_premium,
      tiers,
      package_card_points,
    })

    res.json({
      success: true,
      data: result,
      message: 'Instrument updated successfully',
    })
  }

  // DELETE /api/v1/teachers/instruments/:id
  static async deleteInstrument(req: AuthRequest, res: Response) {
    const id = req.params.id as string

    await TeacherService.deleteInstrument(req.user!.id, id)

    res.json({
      success: true,
      message: 'Instrument deleted successfully',
    })
  }

  // POST /api/v1/teachers/instruments/generate-pointers
  static async generateInstrumentPointers(req: AuthRequest, res: Response) {
    const data = generatePointersSchema.parse(req.body)

    const result = await TeacherService.queueInstrumentPointerGeneration(req.user!.id, {
      instrument_name: data.instrument_name,
      teach_or_perform: data.teach_or_perform,
      class_mode: data.class_mode,
      pricing: data.pricing,
    })

    res.status(202).json({
      success: true,
      data: result,
    })
  }

  // GET /api/v1/teachers/instruments/pointer-status/:requestId
  static async getInstrumentPointerStatus(req: AuthRequest, res: Response) {
    const requestId = String(req.params.requestId || '').trim()
    if (!requestId) {
      throw new AppError(400, 'requestId is required', 'REQUEST_ID_REQUIRED')
    }

    const result = TeacherService.getInstrumentPointerGenerationStatus(req.user!.id, requestId)

    res.json({
      success: true,
      data: result,
    })
  }

  // POST /api/v1/teachers/instruments/pointer-callback
  static async handleInstrumentPointerCallback(req: Request, res: Response) {
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

    const normalizedBody = normalizePointerCallbackBody(req.body)
    const data = pointerCallbackSchema.parse(normalizedBody)
    const result = await TeacherService.applyInstrumentPointerCallback({
      request_id: data.request_id as string,
      teacher_id: data.teacher_id,
      package_card_points: data.package_card_points,
      error: data.error,
    })

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  // GET /api/v1/teachers/profile-completion
  static async getProfileCompletionStatus(req: AuthRequest, res: Response) {
    const result = await TeacherService.getProfileCompletionStatus(req.user!.id)

    res.json({
      success: true,
      data: result,
    })
  }
}
