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
}
