import { Response } from 'express'
import { AuthRequest, AppError } from '../types'
import { AdminService } from '../services/admin.service'
import { teacherCompleteOnboardingSchema } from '../utils/validation'
import { TeacherOnboardingService } from '../services/teacher-onboarding.service'
import prisma from '../config/database'
import { createClient } from '@supabase/supabase-js'
import logger from '../utils/logger'

export class AdminController {
    // POST /api/v1/admin/teachers/register - Admin register a new teacher (creates user + profile + onboarding)
    static async registerTeacher(req: AuthRequest, res: Response): Promise<void> {
      logger.info({ adminId: req.user?.id, email: req.body.email }, '🔵 Admin registering new teacher...')

      const data = teacherCompleteOnboardingSchema.extend({
        email: require('zod').z.string().email('Invalid email'),
        name: require('zod').z.string().min(1, 'Name is required'),
      }).parse(req.body)

      const result = await AdminService.registerTeacher(req.user!.id, data)

      logger.info({ adminId: req.user?.id, teacherId: result.teacher.id }, '✅ Teacher registered by admin successfully')

      res.status(201).json({
        success: true,
        data: {
          message: 'Teacher registered successfully',
          credentials: result.credentials,
          teacher: result.teacher,
        },
      })
    }

  // GET /api/v1/admin/stats - Dashboard statistics
  static async getDashboardStats(_req: AuthRequest, res: Response): Promise<void> {
    const stats = await AdminService.getDashboardStats()
    res.json({
      success: true,
      data: stats,
    })
  }

  // GET /api/v1/admin/teachers - List teachers with filters
  static async listTeachers(req: AuthRequest, res: Response): Promise<void> {
    const result = await AdminService.getTeachers({
      verified: req.query.verified as string,
      onboarding_completed: req.query.onboarding_completed as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    })
    
    res.json({
      success: true,
      data: result.teachers,
      meta: result.pagination,
    })
  }

    // GET /api/v1/admin/teachers/:id - Get detailed teacher information
    static async getTeacherDetails(req: AuthRequest, res: Response): Promise<void> {
      const { id } = req.params
      const teacher = await AdminService.getTeacherDetails(id)
    
      res.json({
        success: true,
        data: teacher,
      })
    }

  // PATCH /api/v1/admin/teachers/:id/verify - Verify/Unverify teacher
  static async updateTeacherVerification(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params
    const { verified } = req.body
    
    const teacher = await AdminService.updateTeacherVerification(id, verified)
    
    res.json({
      success: true,
      data: teacher,
      message: `Teacher ${verified ? 'verified' : 'unverified'} successfully`,
    })
  }

  // GET /api/v1/admin/teachers/:id/onboarding - Get full onboarding-style data for a teacher
  static async getTeacherOnboardingData(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params

    const data = await TeacherOnboardingService.getOnboardingData(id)

    res.status(200).json({
      success: true,
      data,
    })
  }

  // PUT /api/v1/admin/teachers/:id - Update teacher details (same schema as onboarding)
  static async updateTeacherDetails(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params
    
    // Allow optional name/email updates in addition to onboarding data
    const schema = teacherCompleteOnboardingSchema.extend({
      name: require('zod').z.string().min(1).optional(),
      email: require('zod').z.string().email().optional(),
    })

    const parsed = schema.parse(req.body)
    const { name, email, ...onboardingData } = parsed as any

    // Complete onboarding-style update for teacher-related tables
    const updated = await TeacherOnboardingService.completeOnboarding(id, onboardingData)

    // Update display name in profiles and teachers if provided
    if (name) {
      await prisma.profiles.update({
        where: { id },
        data: { name },
      })

      await prisma.teachers.update({
        where: { id },
        data: { name },
      })
    }

    // Update Supabase auth email if provided
    if (email) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { error } = await supabase.auth.admin.updateUserById(id, { email })
      if (error) {
        throw new AppError(400, error.message, 'EMAIL_UPDATE_FAILED')
      }
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Teacher updated successfully',
        teacher: updated,
      },
    })
  }

  // GET /api/v1/admin/users - List all users with filters
  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    const result = await AdminService.getUsers({
      role: req.query.role as string,
      is_active: req.query.is_active as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    })
    
    res.json({
      success: true,
      data: result.users,
      meta: result.pagination,
    })
  }

  // PATCH /api/v1/admin/users/:id/status - Activate/Deactivate user
  static async updateUserStatus(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params
    const { is_active } = req.body
    
    const user = await AdminService.updateUserStatus(id, is_active)
    
    res.json({
      success: true,
      data: user,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
    })
  }

  // GET /api/v1/admin/audit-logs - View audit logs
  static async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    const result = await AdminService.getAuditLogs({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    })
    
    res.json({
      success: true,
      data: result.logs,
      meta: result.pagination,
    })
  }
}
