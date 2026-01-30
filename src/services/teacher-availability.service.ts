import prisma from '../config/database'
import { AppError } from '../types'

// Helper to parse date string to UTC midnight (for database storage)
// We use UTC to avoid timezone shifts when storing DATE type in PostgreSQL
const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Create date at UTC midnight to prevent timezone shifts
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

// Helper to format date to YYYY-MM-DD (from UTC)
const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface DateSlotInput {
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
}

export interface MarkUnavailableInput {
  date: string // YYYY-MM-DD
}

export class TeacherAvailabilityService {
  /**
   * Check if two time ranges overlap (HH:MM format)
   */
  private static timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }

    const s1 = toMinutes(start1)
    const e1 = toMinutes(end1)
    const s2 = toMinutes(start2)
    const e2 = toMinutes(end2)

    return s1 < e2 && e1 > s2
  }

  /**
   * Add a single availability slot for a specific date
   */
  static async addSlot(teacherId: string, data: DateSlotInput) {
    const specificDate = parseDate(data.date)
    const dayOfWeek = specificDate.getUTCDay()

    // Validate time
    const startMinutes = parseInt(data.start_time.split(':')[0]) * 60 + parseInt(data.start_time.split(':')[1])
    const endMinutes = parseInt(data.end_time.split(':')[0]) * 60 + parseInt(data.end_time.split(':')[1])
    
    if (endMinutes <= startMinutes) {
      throw new AppError(400, 'End time must be after start time', 'INVALID_TIME')
    }

    // Check if date is marked as unavailable
    const unavailableMarker = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: specificDate,
        is_unavailable: true,
      },
    })

    if (unavailableMarker) {
      throw new AppError(409, 'Cannot add slots to a date marked as unavailable', 'DATE_UNAVAILABLE')
    }

    // Check for overlapping slots on the same date
    const existingSlots = await prisma.teacher_availability.findMany({
      where: {
        teacher_id: teacherId,
        specific_date: specificDate,
        is_unavailable: false,
      },
    })

    for (const slot of existingSlots) {
      if (this.timesOverlap(data.start_time, data.end_time, slot.start_time, slot.end_time)) {
        throw new AppError(
          409,
          `Time slot overlaps with existing slot (${slot.start_time} - ${slot.end_time})`,
          'SLOT_OVERLAP'
        )
      }
    }

    // Create the slot
    const slot = await prisma.teacher_availability.create({
      data: {
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        start_time: data.start_time,
        end_time: data.end_time,
        is_recurring: false,
        specific_date: specificDate,
        is_unavailable: false,
      },
    })

    return slot
  }

  /**
   * Add multiple slots at once (bulk operation)
   */
  static async addBulkSlots(teacherId: string, slots: DateSlotInput[]) {
    const results = []
    const errors = []

    for (const slotData of slots) {
      try {
        const slot = await this.addSlot(teacherId, slotData)
        results.push(slot)
      } catch (error) {
        if (error instanceof AppError) {
          errors.push({
            slot: slotData,
            error: error.message,
          })
        } else {
          throw error
        }
      }
    }

    return { created: results, errors }
  }

  /**
   * Get all slots for a teacher within a date range
   */
  static async getSlots(teacherId: string, startDate?: string, endDate?: string) {
    const where: any = {
      teacher_id: teacherId,
      is_unavailable: false,
    }

    if (startDate && endDate) {
      where.specific_date = {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      }
    }

    const slots = await prisma.teacher_availability.findMany({
      where,
      orderBy: [{ specific_date: 'asc' }, { start_time: 'asc' }],
    })

    return slots
  }

  /**
   * Get all slots for a teacher (simplified - returns all)
   */
  static async getAllSlots(teacherId: string) {
    const slots = await prisma.teacher_availability.findMany({
      where: { 
        teacher_id: teacherId,
        is_unavailable: false,
      },
      orderBy: [{ specific_date: 'asc' }, { start_time: 'asc' }],
    })

    return slots
  }

  /**
   * Get a specific slot by ID
   */
  static async getSlot(slotId: string, teacherId: string) {
    const slot = await prisma.teacher_availability.findUnique({
      where: { id: slotId },
    })

    if (!slot) {
      throw new AppError(404, 'Availability slot not found', 'SLOT_NOT_FOUND')
    }

    if (slot.teacher_id !== teacherId) {
      throw new AppError(403, 'Not authorized to access this slot', 'FORBIDDEN')
    }

    return slot
  }

  /**
   * Update a specific slot
   */
  static async updateSlot(
    slotId: string,
    teacherId: string,
    data: { start_time?: string; end_time?: string }
  ) {
    // Verify ownership
    const existing = await this.getSlot(slotId, teacherId)

    const newStartTime = data.start_time ?? existing.start_time
    const newEndTime = data.end_time ?? existing.end_time

    // Validate time
    const startMinutes = parseInt(newStartTime.split(':')[0]) * 60 + parseInt(newStartTime.split(':')[1])
    const endMinutes = parseInt(newEndTime.split(':')[0]) * 60 + parseInt(newEndTime.split(':')[1])
    
    if (endMinutes <= startMinutes) {
      throw new AppError(400, 'End time must be after start time', 'INVALID_TIME')
    }

    // Check for overlaps with other slots on the same date (excluding current slot)
    const otherSlots = await prisma.teacher_availability.findMany({
      where: {
        teacher_id: teacherId,
        specific_date: existing.specific_date,
        id: { not: slotId },
        is_unavailable: false,
      },
    })

    for (const slot of otherSlots) {
      if (this.timesOverlap(newStartTime, newEndTime, slot.start_time, slot.end_time)) {
        throw new AppError(
          409,
          `Time slot overlaps with existing slot (${slot.start_time} - ${slot.end_time})`,
          'SLOT_OVERLAP'
        )
      }
    }

    const updated = await prisma.teacher_availability.update({
      where: { id: slotId },
      data: {
        start_time: newStartTime,
        end_time: newEndTime,
      },
    })

    return updated
  }

  /**
   * Delete a specific slot by ID
   */
  static async deleteSlot(slotId: string, teacherId: string) {
    // Verify ownership
    await this.getSlot(slotId, teacherId)

    await prisma.teacher_availability.delete({
      where: { id: slotId },
    })

    return { success: true }
  }

  /**
   * Delete all slots for a specific date
   */
  static async deleteSlotsForDate(teacherId: string, date: string) {
    const specificDate = parseDate(date)

    const result = await prisma.teacher_availability.deleteMany({
      where: {
        teacher_id: teacherId,
        specific_date: specificDate,
      },
    })

    return { deleted: result.count }
  }

  /**
   * Replace all slots for a specific date
   */
  static async replaceSlotsForDate(teacherId: string, date: string, slots: { start_time: string; end_time: string }[]) {
    const specificDate = parseDate(date)
    const dayOfWeek = specificDate.getUTCDay()

    // Validate all slots first
    for (const slot of slots) {
      const startMinutes = parseInt(slot.start_time.split(':')[0]) * 60 + parseInt(slot.start_time.split(':')[1])
      const endMinutes = parseInt(slot.end_time.split(':')[0]) * 60 + parseInt(slot.end_time.split(':')[1])
      
      if (endMinutes <= startMinutes) {
        throw new AppError(400, `Invalid slot: End time (${slot.end_time}) must be after start time (${slot.start_time})`, 'INVALID_TIME')
      }
    }

    // Check for overlaps between new slots
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (this.timesOverlap(slots[i].start_time, slots[i].end_time, slots[j].start_time, slots[j].end_time)) {
          throw new AppError(
            409,
            `Slots overlap: ${slots[i].start_time}-${slots[i].end_time} and ${slots[j].start_time}-${slots[j].end_time}`,
            'SLOT_OVERLAP'
          )
        }
      }
    }

    // Use transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing slots for this date
      await tx.teacher_availability.deleteMany({
        where: {
          teacher_id: teacherId,
          specific_date: specificDate,
        },
      })

      // Create new slots
      if (slots.length > 0) {
        await tx.teacher_availability.createMany({
          data: slots.map((slot) => ({
            teacher_id: teacherId,
            day_of_week: dayOfWeek,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_recurring: false,
            specific_date: specificDate,
            is_unavailable: false,
          })),
        })
      }

      // Fetch and return new slots
      return await tx.teacher_availability.findMany({
        where: {
          teacher_id: teacherId,
          specific_date: specificDate,
          is_unavailable: false,
        },
        orderBy: { start_time: 'asc' },
      })
    })

    return result
  }

  /**
   * Mark a date as unavailable
   */
  static async markUnavailable(teacherId: string, date: string) {
    const specificDate = parseDate(date)
    const dayOfWeek = specificDate.getUTCDay()

    // Delete any existing slots for this date
    await prisma.teacher_availability.deleteMany({
      where: {
        teacher_id: teacherId,
        specific_date: specificDate,
      },
    })

    // Create unavailable marker
    const marker = await prisma.teacher_availability.create({
      data: {
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        start_time: '00:00',
        end_time: '00:00',
        is_recurring: false,
        specific_date: specificDate,
        is_unavailable: true,
      },
    })

    return marker
  }

  /**
   * Remove unavailable marker for a date
   */
  static async removeUnavailable(teacherId: string, date: string) {
    const specificDate = parseDate(date)

    const result = await prisma.teacher_availability.deleteMany({
      where: {
        teacher_id: teacherId,
        specific_date: specificDate,
        is_unavailable: true,
      },
    })

    return { removed: result.count > 0 }
  }

  /**
   * Get all unavailable dates for a teacher
   */
  static async getUnavailableDates(teacherId: string, startDate?: string, endDate?: string) {
    const where: any = {
      teacher_id: teacherId,
      is_unavailable: true,
    }

    if (startDate && endDate) {
      where.specific_date = {
        gte: parseDate(startDate),
        lte: parseDate(endDate),
      }
    }

    const slots = await prisma.teacher_availability.findMany({
      where,
      orderBy: { specific_date: 'asc' },
    })

    return slots.map((s) => ({
      id: s.id,
      date: s.specific_date ? formatDate(s.specific_date) : null,
    }))
  }

  /**
   * Get available time slots for booking (used by students)
   */
  static async getAvailableSlots(
    teacherId: string,
    startDate: string,
    endDate: string,
    durationMinutes: number = 60
  ) {
    const start = parseDate(startDate)
    const end = parseDate(endDate)

    // Get all availability slots in range
    const availability = await prisma.teacher_availability.findMany({
      where: {
        teacher_id: teacherId,
        specific_date: {
          gte: start,
          lte: end,
        },
        is_unavailable: false,
      },
      orderBy: [{ specific_date: 'asc' }, { start_time: 'asc' }],
    })

    if (availability.length === 0) {
      return []
    }

    // Get existing bookings in the date range
    const bookings = await prisma.bookings.findMany({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          gte: start,
          lte: new Date(end.getTime() + 24 * 60 * 60 * 1000), // Include end date
        },
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        scheduled_at: true,
        duration_minutes: true,
      },
    })

    // Generate available slots
    const slots: { date: string; startTime: string; endTime: string; duration: number }[] = []
    const now = new Date()

    for (const availSlot of availability) {
      if (!availSlot.specific_date) continue

      const dateStr = formatDate(availSlot.specific_date)
      const generatedSlots = this.generateTimeSlots(
        availSlot.specific_date,
        availSlot.start_time,
        availSlot.end_time,
        durationMinutes
      )

      for (const slot of generatedSlots) {
        const slotStart = new Date(`${slot.date}T${slot.startTime}:00`)
        const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`)

        // Skip past slots
        if (slotStart <= now) continue

        // Check if overlaps with any booking
        const isBooked = bookings.some((booking) => {
          const bookingStart = new Date(booking.scheduled_at)
          const bookingEnd = new Date(
            bookingStart.getTime() + (booking.duration_minutes || 60) * 60 * 1000
          )
          return slotStart < bookingEnd && slotEnd > bookingStart
        })

        if (!isBooked) {
          slots.push(slot)
        }
      }
    }

    return slots
  }

  /**
   * Generate time slots within a time window
   */
  private static generateTimeSlots(
    date: Date,
    startTime: string,
    endTime: string,
    durationMinutes: number
  ): { date: string; startTime: string; endTime: string; duration: number }[] {
    const slots = []
    const dateStr = formatDate(date)

    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }

    const toTimeStr = (minutes: number) => {
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }

    let currentMinutes = toMinutes(startTime)
    const endMinutes = toMinutes(endTime)

    while (currentMinutes + durationMinutes <= endMinutes) {
      slots.push({
        date: dateStr,
        startTime: toTimeStr(currentMinutes),
        endTime: toTimeStr(currentMinutes + durationMinutes),
        duration: durationMinutes,
      })
      currentMinutes += durationMinutes
    }

    return slots
  }

  /**
   * Get teacher's calendar view (availability + bookings)
   */
  static async getCalendarView(teacherId: string, startDate: string, endDate: string) {
    const start = parseDate(startDate)
    const end = parseDate(endDate)

    const [availability, bookings] = await Promise.all([
      prisma.teacher_availability.findMany({
        where: {
          teacher_id: teacherId,
          specific_date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: [{ specific_date: 'asc' }, { start_time: 'asc' }],
      }),
      prisma.bookings.findMany({
        where: {
          teacher_id: teacherId,
          scheduled_at: {
            gte: start,
            lte: new Date(end.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          students: {
            include: {
              profiles: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { scheduled_at: 'asc' },
      }),
    ])

    return {
      availability: availability.map((a) => ({
        id: a.id,
        date: a.specific_date ? formatDate(a.specific_date) : null,
        start_time: a.start_time,
        end_time: a.end_time,
        is_unavailable: a.is_unavailable,
      })),
      bookings: bookings.map((b) => ({
        id: b.id,
        scheduled_at: b.scheduled_at,
        duration_minutes: b.duration_minutes,
        status: b.status,
        booking_type: b.booking_type,
        student_name: b.students?.profiles?.name || 'Unknown',
        notes: b.notes,
      })),
    }
  }
}
