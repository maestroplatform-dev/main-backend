import { Response } from 'express'
import { AuthRequest } from '../types'
import prisma from '../config/database'

export class AdminController {
  static async listProfiles(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const profiles = await prisma.profiles.findMany({
        include: {
          students: true,
          teachers: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 100,
      })

      res.json({
        success: true,
        data: profiles,
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch profiles',
      })
    }
  }

  // GET /api/v1/admin/teachers - Fetch all teachers with onboarding data
  static async listTeachers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const limitParam = Math.min(parseInt(req.query.limit as string) || 20, 100)
      const offsetParam = parseInt(req.query.offset as string) || 0
      const onboarding_completed = req.query.onboarding_completed as string | undefined

      // Build where filter
      const where: any = {}
      if (onboarding_completed !== undefined) {
        where.onboarding_completed = onboarding_completed === 'true'
      }

      // Fetch teachers with basic profile info
      const teachers = await prisma.teachers.findMany({
        where,
        include: {
          profiles: {
            select: {
              name: true,
              role: true,
              is_active: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limitParam,
        skip: offsetParam,
      })

      const total = await prisma.teachers.count({ where })

      res.json({
        success: true,
        data: teachers,
        meta: {
          total,
          limit: limitParam,
          offset: offsetParam,
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch teachers',
      })
    }
  }

  // GET /api/v1/admin/teachers/:id - Get single teacher with full onboarding data
  static async getTeacherDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Teacher ID is required',
        })
        return
      }

      const teacher = await prisma.teachers.findUnique({
        where: { id },
        include: {
          profiles: {
            select: {
              name: true,
              role: true,
              is_active: true,
            },
          },
        },
      })

      if (!teacher) {
        res.status(404).json({
          success: false,
          error: 'Teacher not found',
        })
        return
      }

      res.json({
        success: true,
        data: teacher,
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch teacher details',
      })
    }
  }
}
