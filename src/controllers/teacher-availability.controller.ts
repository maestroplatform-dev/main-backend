import { Response } from 'express'
import { AuthRequest } from '../types'
import { TeacherAvailabilityService } from '../services/teacher-availability.service'
import { z } from 'zod'
import logger from '../utils/logger'

// Validation schemas
const addSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
})

const addBulkSlotsSchema = z.object({
  slots: z.array(addSlotSchema),
})

const replaceSlotsForDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  slots: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  })),
})

const markUnavailableSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
})

const getAvailableSlotsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  duration: z.coerce.number().min(15).max(240).optional().default(60),
})

export class TeacherAvailabilityController {
  /**
   * POST /api/v1/teachers/availability/slot
   * Add a single availability slot for a specific date
   */
  static async addSlot(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id, body: req.body }, '🔵 Adding availability slot')

    const data = addSlotSchema.parse(req.body)
    const slot = await TeacherAvailabilityService.addSlot(req.user!.id, data)

    logger.info({ userId: req.user?.id, slotId: slot.id, date: data.date }, '✅ Slot added')

    res.status(201).json({
      success: true,
      data: slot,
    })
  }

  /**
   * POST /api/v1/teachers/availability/slots
   * Add multiple availability slots at once
   */
  static async addBulkSlots(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id }, '🔵 Adding bulk slots')

    const { slots } = addBulkSlotsSchema.parse(req.body)
    const result = await TeacherAvailabilityService.addBulkSlots(req.user!.id, slots)

    logger.info(
      { userId: req.user?.id, created: result.created.length, errors: result.errors.length },
      '✅ Bulk slots processed'
    )

    res.status(201).json({
      success: true,
      data: result,
    })
  }

  /**
   * PUT /api/v1/teachers/availability/date
   * Replace all slots for a specific date
   */
  static async replaceSlotsForDate(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id, body: req.body }, '🔵 Replacing slots for date')

    const { date, slots } = replaceSlotsForDateSchema.parse(req.body)
    const result = await TeacherAvailabilityService.replaceSlotsForDate(req.user!.id, date, slots)

    logger.info({ userId: req.user?.id, date, count: result.length }, '✅ Slots replaced for date')

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  /**
   * GET /api/v1/teachers/availability/me
   * Get all availability slots for the current teacher
   */
  static async getMySlots(req: AuthRequest, res: Response) {
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined

    logger.info({ userId: req.user?.id, startDate, endDate }, '🔵 Fetching slots')

    const slots = await TeacherAvailabilityService.getSlots(req.user!.id, startDate, endDate)

    res.status(200).json({
      success: true,
      data: slots,
    })
  }

  /**
   * GET /api/v1/teachers/availability/:id
   * Get a specific slot by ID
   */
  static async getSlot(req: AuthRequest, res: Response) {
    const slot = await TeacherAvailabilityService.getSlot(req.params.id as string, req.user!.id)

    res.status(200).json({
      success: true,
      data: slot,
    })
  }

  /**
   * PUT /api/v1/teachers/availability/:id
   * Update a specific slot
   */
  static async updateSlot(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id, slotId: req.params.id }, '🔵 Updating slot')

    const data = z.object({
      start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).parse(req.body)

    const slot = await TeacherAvailabilityService.updateSlot(req.params.id as string, req.user!.id, data)

    logger.info({ userId: req.user?.id, slotId: slot.id }, '✅ Slot updated')

    res.status(200).json({
      success: true,
      data: slot,
    })
  }

  /**
   * DELETE /api/v1/teachers/availability/:id
   * Delete a specific slot by ID
   */
  static async deleteSlot(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id, slotId: req.params.id }, '🔵 Deleting slot')

    await TeacherAvailabilityService.deleteSlot(req.params.id as string, req.user!.id)

    logger.info({ userId: req.user?.id, slotId: req.params.id }, '✅ Slot deleted')

    res.status(200).json({
      success: true,
      message: 'Slot deleted successfully',
    })
  }

  /**
   * DELETE /api/v1/teachers/availability/date/:date
   * Delete all slots for a specific date
   */
  static async deleteSlotsForDate(req: AuthRequest, res: Response) {
    const date = req.params.date as string

    logger.info({ userId: req.user?.id, date }, '🔵 Deleting slots for date')

    const result = await TeacherAvailabilityService.deleteSlotsForDate(req.user!.id, date)

    logger.info({ userId: req.user?.id, date, deleted: result.deleted }, '✅ Slots deleted')

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  /**
   * POST /api/v1/teachers/availability/unavailable
   * Mark a date as unavailable
   */
  static async markUnavailable(req: AuthRequest, res: Response) {
    logger.info({ userId: req.user?.id, body: req.body }, '🔵 Marking date unavailable')

    const { date } = markUnavailableSchema.parse(req.body)
    const marker = await TeacherAvailabilityService.markUnavailable(req.user!.id, date)

    logger.info({ userId: req.user?.id, date }, '✅ Date marked unavailable')

    res.status(201).json({
      success: true,
      data: marker,
    })
  }

  /**
   * DELETE /api/v1/teachers/availability/unavailable/:date
   * Remove unavailable marker for a date
   */
  static async removeUnavailable(req: AuthRequest, res: Response) {
    const date = req.params.date as string

    logger.info({ userId: req.user?.id, date }, '🔵 Removing unavailable marker')

    const result = await TeacherAvailabilityService.removeUnavailable(req.user!.id, date)

    logger.info({ userId: req.user?.id, date, removed: result.removed }, '✅ Unavailable marker removed')

    res.status(200).json({
      success: true,
      data: result,
    })
  }

  /**
   * GET /api/v1/teachers/availability/unavailable
   * Get list of unavailable dates
   */
  static async getUnavailableDates(req: AuthRequest, res: Response) {
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined

    const dates = await TeacherAvailabilityService.getUnavailableDates(req.user!.id, startDate, endDate)

    res.status(200).json({
      success: true,
      data: dates,
    })
  }

  /**
   * GET /api/v1/teachers/calendar
   * Get calendar view (availability + bookings) for a date range
   */
  static async getCalendar(req: AuthRequest, res: Response) {
    const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0]
    const endDate = (req.query.endDate as string) || (() => {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      return d.toISOString().split('T')[0]
    })()

    logger.info({ userId: req.user?.id, startDate, endDate }, '🔵 Fetching calendar view')

    const calendar = await TeacherAvailabilityService.getCalendarView(
      req.user!.id,
      startDate,
      endDate
    )

    res.status(200).json({
      success: true,
      data: calendar,
    })
  }

  /**
   * GET /api/v1/teachers/:teacherId/available-slots
   * Get available booking slots for a teacher (public endpoint for students)
   */
  static async getAvailableSlots(req: AuthRequest, res: Response) {
    const teacherId = req.params.teacherId as string
    const query = getAvailableSlotsSchema.parse(req.query)

    logger.info(
      { teacherId, startDate: query.startDate, endDate: query.endDate, duration: query.duration },
      '🔵 Fetching available slots for booking'
    )

    const slots = await TeacherAvailabilityService.getAvailableSlots(
      teacherId,
      query.startDate,
      query.endDate,
      query.duration
    )

    res.status(200).json({
      success: true,
      data: {
        teacherId,
        slots,
        total: slots.length,
      },
    })
  }

  /**
   * GET /api/v1/teachers/:teacherId/unavailable-dates
   * Public endpoint: returns dates the teacher marked unavailable
   */
  static async getPublicUnavailableDates(req: AuthRequest, res: Response) {
    const teacherId = req.params.teacherId as string
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined

    const dates = await TeacherAvailabilityService.getUnavailableDates(teacherId, startDate, endDate)

    res.status(200).json({
      success: true,
      data: dates,
    })
  }
}
