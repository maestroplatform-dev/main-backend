import prisma from "../config/database";
import { booking_status } from "@prisma/client";

// Demo class duration in minutes
const DEMO_DURATION_MINUTES = 30;

export class BookingService {
  /**
   * Request a demo class (student -> teacher)
   * Creates a booking with PENDING_APPROVAL status
   */
  async requestDemo(
    studentId: string,
    teacherId: string,
    scheduledAt: Date,
    notes?: string
  ) {
    // Ensure student record exists
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      // Create student record if it doesn't exist
      await prisma.students.create({
        data: {
          id: studentId,
          onboarding_status: "email_entry",
        },
      });
    }

    // Validate the slot is still available
    const isAvailable = await this.isSlotAvailable(teacherId, scheduledAt);
    if (!isAvailable) {
      throw new Error("This time slot is no longer available");
    }

    // Create the booking request
    const booking = await prisma.bookings.create({
      data: {
        student_id: studentId,
        teacher_id: teacherId,
        booking_type: "demo",
        status: "PENDING_APPROVAL",
        scheduled_at: scheduledAt,
        duration_minutes: DEMO_DURATION_MINUTES,
        is_demo: true,
        notes,
      },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            profiles: {
              select: { id: true },
            },
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return booking;
  }

  /**
   * Check if a time slot is available for a teacher
   * A slot is unavailable if:
   * 1. Teacher marked it as unavailable
   * 2. There's already a pending/scheduled booking at that time
   */
  async isSlotAvailable(teacherId: string, scheduledAt: Date): Promise<boolean> {
    const dateStr = scheduledAt.toISOString().split("T")[0];
    const timeStr = scheduledAt.toTimeString().slice(0, 5); // HH:MM format

    // Check if teacher has this slot in their availability
    const availability = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: new Date(dateStr),
        start_time: timeStr,
        is_unavailable: false,
      },
    });

    if (!availability) {
      return false;
    }

    // Check for existing bookings at this time
    const endTime = new Date(scheduledAt.getTime() + DEMO_DURATION_MINUTES * 60 * 1000);
    
    const existingBooking = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          gte: scheduledAt,
          lt: endTime,
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
      },
    });

    return !existingBooking;
  }

  /**
   * Get teacher's public availability (for students to book)
   * Filters out unavailable dates and already booked slots
   */
  async getPublicAvailability(teacherId: string, startDate: Date, endDate: Date) {
    // Get all availability slots for the teacher in the date range
    const availability = await prisma.teacher_availability.findMany({
      where: {
        teacher_id: teacherId,
        specific_date: {
          gte: startDate,
          lte: endDate,
        },
        is_unavailable: false,
      },
      orderBy: [{ specific_date: "asc" }, { start_time: "asc" }],
    });

    // Get all existing bookings for the teacher in the date range
    const bookings = await prisma.bookings.findMany({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
      },
      select: {
        scheduled_at: true,
        duration_minutes: true,
      },
    });

    // Create a set of booked time slots for quick lookup
    const bookedSlots = new Set<string>();
    bookings.forEach((booking) => {
      const dateStr = booking.scheduled_at.toISOString().split("T")[0];
      const timeStr = booking.scheduled_at.toTimeString().slice(0, 5);
      bookedSlots.add(`${dateStr}_${timeStr}`);
    });

    // Filter out booked slots from availability
    const availableSlots = availability.filter((slot) => {
      if (!slot.specific_date) return false;
      const dateStr = slot.specific_date.toISOString().split("T")[0];
      const key = `${dateStr}_${slot.start_time}`;
      return !bookedSlots.has(key);
    });

    return availableSlots;
  }

  /**
   * Get all bookings for a teacher (for actionables dashboard)
   */
  async getTeacherBookings(teacherId: string, status?: booking_status[]) {
    const where: any = { teacher_id: teacherId };
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        students: {
          select: {
            id: true,
            name: true,
            profile_picture_url: true,
            profiles: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Transform the response to use profile name if student name is null
    const transformedBookings = bookings.map((booking: any) => ({
      ...booking,
      students: {
        id: booking.students.id,
        name: booking.students.name || booking.students.profiles?.name || null,
        profile_picture_url: booking.students.profile_picture_url,
      },
    }));

    return transformedBookings;
  }

  /**
   * Get all bookings for a student
   */
  async getStudentBookings(studentId: string, status?: booking_status[]) {
    const where: any = { student_id: studentId };
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        teachers: {
          select: {
            id: true,
            name: true,
            profile_picture: true,
            profiles: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Transform the response to use profile name if teacher name is null
    const transformedBookings = bookings.map((booking: any) => ({
      ...booking,
      teachers: {
        id: booking.teachers.id,
        name: booking.teachers.name || booking.teachers.profiles?.name || null,
        profile_picture: booking.teachers.profile_picture,
      },
    }));

    return transformedBookings;
  }

  /**
   * Get a single booking by ID
   */
  async getBookingById(bookingId: string) {
    return prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            profile_picture_url: true,
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            profile_picture: true,
          },
        },
      },
    });
  }

  /**
   * Teacher accepts a demo request
   */
  async acceptBooking(bookingId: string, teacherId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.teacher_id !== teacherId) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "PENDING_APPROVAL") {
      throw new Error("Booking cannot be accepted in current status");
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "SCHEDULED",
        updated_at: new Date(),
      },
      include: {
        students: {
          select: { id: true, name: true },
        },
        teachers: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Teacher proposes a new time (reschedule)
   */
  async rescheduleBooking(
    bookingId: string,
    teacherId: string,
    newScheduledAt: Date
  ) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.teacher_id !== teacherId) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "PENDING_APPROVAL") {
      throw new Error("Booking cannot be rescheduled in current status");
    }

    // Check if the new time is available
    const isAvailable = await this.isSlotAvailable(teacherId, newScheduledAt);
    if (!isAvailable) {
      throw new Error("The proposed time slot is not available");
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "RESCHEDULE_PROPOSED",
        rescheduled_at: newScheduledAt,
        rescheduled_by: teacherId,
        updated_at: new Date(),
      },
      include: {
        students: {
          select: { id: true, name: true },
        },
        teachers: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Student confirms the rescheduled time
   */
  async confirmReschedule(bookingId: string, studentId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.student_id !== studentId) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "RESCHEDULE_PROPOSED") {
      throw new Error("No reschedule to confirm");
    }

    if (!booking.rescheduled_at) {
      throw new Error("No rescheduled time found");
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "SCHEDULED",
        scheduled_at: booking.rescheduled_at,
        rescheduled_at: null,
        rescheduled_by: null,
        updated_at: new Date(),
      },
      include: {
        students: {
          select: { id: true, name: true },
        },
        teachers: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Cancel a booking (by either party)
   */
  async cancelBooking(bookingId: string, userId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if user is either the student or teacher
    if (booking.student_id !== userId && booking.teacher_id !== userId) {
      throw new Error("Unauthorized");
    }

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
      throw new Error("Booking cannot be cancelled in current status");
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get pending demo requests count for teacher (for badge/notification)
   */
  async getPendingRequestsCount(teacherId: string): Promise<number> {
    return prisma.bookings.count({
      where: {
        teacher_id: teacherId,
        status: "PENDING_APPROVAL",
        is_demo: true,
      },
    });
  }
}

export const bookingService = new BookingService();
