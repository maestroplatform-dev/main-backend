import { Request, Response } from 'express'
import { AuthRequest } from '../types'
import { FeaturedTeachersService } from '../services/featured-teachers.service'
import { z } from 'zod'

const setFeaturedTeachersSchema = z.object({
  teacherIds: z.array(z.string().uuid()).max(10),
})

const addFeaturedTeacherSchema = z.object({
  teacherId: z.string().uuid(),
})

const updateOrderSchema = z.object({
  teacherIds: z.array(z.string().uuid()),
})

export class FeaturedTeachersController {
  // GET /api/v1/featured-teachers (public)
  static async getFeaturedTeachers(_req: Request, res: Response): Promise<void> {
    const teachers = await FeaturedTeachersService.getFeaturedTeachers()

    res.json({
      success: true,
      data: teachers,
    })
  }

  // GET /api/v1/admin/featured-teachers (admin - get IDs)
  static async getAdminFeaturedTeachers(_req: AuthRequest, res: Response): Promise<void> {
    const featured = await FeaturedTeachersService.getFeaturedTeacherIds()

    res.json({
      success: true,
      data: featured,
    })
  }

  // PUT /api/v1/admin/featured-teachers (admin - set all)
  static async setFeaturedTeachers(req: AuthRequest, res: Response): Promise<void> {
    const { teacherIds } = setFeaturedTeachersSchema.parse(req.body)
    
    const result = await FeaturedTeachersService.setFeaturedTeachers(teacherIds, req.user!.id)

    res.json({
      success: true,
      data: result,
      message: `${result.count} teachers set as featured`,
    })
  }

  // POST /api/v1/admin/featured-teachers (admin - add one)
  static async addFeaturedTeacher(req: AuthRequest, res: Response): Promise<void> {
    const { teacherId } = addFeaturedTeacherSchema.parse(req.body)
    
    const result = await FeaturedTeachersService.addFeaturedTeacher(teacherId, req.user!.id)

    res.status(201).json({
      success: true,
      data: result,
      message: 'Teacher added to featured',
    })
  }

  // DELETE /api/v1/admin/featured-teachers/:teacherId (admin - remove one)
  static async removeFeaturedTeacher(req: AuthRequest, res: Response): Promise<void> {
    const teacherId = req.params.teacherId as string
    
    await FeaturedTeachersService.removeFeaturedTeacher(teacherId)

    res.json({
      success: true,
      message: 'Teacher removed from featured',
    })
  }

  // PATCH /api/v1/admin/featured-teachers/order (admin - reorder)
  static async updateDisplayOrder(req: AuthRequest, res: Response): Promise<void> {
    const { teacherIds } = updateOrderSchema.parse(req.body)
    
    await FeaturedTeachersService.updateDisplayOrder(teacherIds)

    res.json({
      success: true,
      message: 'Display order updated',
    })
  }
}
