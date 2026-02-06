import { Request, Response } from 'express'
import { AuthRequest } from '../types'
import { TeacherService } from '../services/teacher.service'
import { teacherOnboardingSchema, teacherProfileUpdateSchema } from '../utils/validation'

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
    const teacher = await TeacherService.getProfile(req.params.id)

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

  // GET /api/v1/teachers (public - list all)
  static async getAllTeachers(req: Request, res: Response) {
    const verified = req.query.verified === 'true'
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    const teachers = await TeacherService.getAllTeachers({
      verified,
      limit,
      offset,
    })

    res.json({
      success: true,
      data: teachers,
      meta: {
        limit,
        offset,
        count: teachers.length,
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
    const { instrument, teach_or_perform, class_mode, base_price, performance_fee_inr, open_to_international, international_premium, tiers } = req.body

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
    })

    res.status(201).json({
      success: true,
      data: result,
      message: 'Instrument created successfully',
    })
  }

  // PUT /api/v1/teachers/instruments/:id
  static async updateInstrument(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { instrument, teach_or_perform, class_mode, base_price, performance_fee_inr, open_to_international, international_premium, tiers } = req.body

    const result = await TeacherService.updateInstrument(req.user!.id, id, {
      instrument,
      teach_or_perform,
      class_mode,
      base_price,
      performance_fee_inr,
      open_to_international,
      international_premium,
      tiers,
    })

    res.json({
      success: true,
      data: result,
      message: 'Instrument updated successfully',
    })
  }

  // DELETE /api/v1/teachers/instruments/:id
  static async deleteInstrument(req: AuthRequest, res: Response) {
    const { id } = req.params

    await TeacherService.deleteInstrument(req.user!.id, id)

    res.json({
      success: true,
      message: 'Instrument deleted successfully',
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
