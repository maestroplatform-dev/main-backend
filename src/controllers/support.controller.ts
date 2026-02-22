import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest, AppError } from '../types'

export class SupportController {
  /**
   * Student: Create a new support ticket
   */
  static async createTicket(req: AuthRequest, res: Response) {
    const studentId = req.user!.id
    const { subject, message } = req.body

    if (!subject?.trim() || !message?.trim()) {
      throw new AppError(400, 'Subject and message are required', 'VALIDATION_ERROR')
    }

    const ticket = await prisma.support_tickets.create({
      data: {
        student_id: studentId,
        subject: subject.trim(),
        message: message.trim(),
      },
    })

    res.status(201).json({
      success: true,
      data: { ticket },
    })
  }

  /**
   * Student: Get their own support tickets
   */
  static async getStudentTickets(req: AuthRequest, res: Response) {
    const studentId = req.user!.id

    const tickets = await prisma.support_tickets.findMany({
      where: { student_id: studentId },
      orderBy: { created_at: 'desc' },
    })

    res.json({
      success: true,
      data: { tickets },
    })
  }

  /**
   * Admin: Get all support tickets with student details
   */
  static async getAllTickets(req: AuthRequest, res: Response) {
    const { status, page = '1', limit = '20' } = req.query

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const [tickets, total] = await Promise.all([
      prisma.support_tickets.findMany({
        where,
        include: {
          students: {
            select: {
              id: true,
              name: true,
              guardian_name: true,
              guardian_phone: true,
              profiles: {
                select: {
                  users: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.support_tickets.count({ where }),
    ])

    // Flatten the response for cleaner data
    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      admin_notes: ticket.admin_notes,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      student: {
        id: ticket.students.id,
        name: ticket.students.name,
        email: ticket.students.profiles?.users?.email || null,
        guardian_name: ticket.students.guardian_name,
        guardian_phone: ticket.students.guardian_phone,
      },
    }))

    res.json({
      success: true,
      data: { tickets: formattedTickets },
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
      },
    })
  }

  /**
   * Admin: Update ticket status and/or add notes
   */
  static async updateTicket(req: AuthRequest, res: Response) {
    const id = req.params.id as string
    const { status, admin_notes } = req.body

    console.log('[SUPPORT] updateTicket called:', { id, status, admin_notes, body: req.body })

    const existing = await prisma.support_tickets.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(404, 'Support ticket not found', 'NOT_FOUND')
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
    if (status && !validStatuses.includes(status)) {
      throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 'VALIDATION_ERROR')
    }

    const updateData: any = { updated_at: new Date() }
    if (status) updateData.status = status
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes

    console.log('[SUPPORT] Updating with data:', updateData)

    const ticket = await prisma.support_tickets.update({
      where: { id },
      data: updateData,
    })

    console.log('[SUPPORT] Updated ticket result:', { id: ticket.id, status: ticket.status })

    res.json({
      success: true,
      data: { ticket },
    })
  }
}
