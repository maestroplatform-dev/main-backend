import { Response } from 'express'
import { AuthRequest } from '../types'
import { AdminService } from '../services/admin.service'
import { adminRegisterTeacherSchema } from '../utils/validation'
import { processEmailQueue } from '../utils/email'

export class AdminController {
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

  // POST /api/v1/admin/teachers/register - Register teacher on behalf (admin only)
  static async registerTeacher(req: AuthRequest, res: Response): Promise<void> {
    const data = adminRegisterTeacherSchema.parse(req.body)
    
    const result = await AdminService.registerTeacher(data)
    
    res.status(201).json({
      success: true,
      data: {
        message: 'Teacher registered successfully',
        profile: result.profile,
        teacher: result.teacher,
        credentials: {
          email: result.credentials.email,
          password: result.credentials.password,
          note: 'Send these credentials to the teacher via secure channel',
        },
      },
    })
  }

  // POST /api/v1/admin/emails/process-queue - Process queued emails
  static async processEmailQueue(_req: AuthRequest, res: Response): Promise<void> {
    const result = await processEmailQueue()
    
    res.json({
      success: true,
      data: result,
      message: `Processed email queue: ${result.sent} sent, ${result.failed} failed`,
    })
  }
}
