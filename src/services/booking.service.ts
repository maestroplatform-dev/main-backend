import prisma from "../config/database";
import { booking_status } from "@prisma/client";
import { nanoid } from 'nanoid';

// Demo class duration in minutes
const DEMO_DURATION_MINUTES = 30;

export class BookingService {
  /**
   * Schedule a session from a purchased package
   */
  async schedulePackageSession(
    studentId: string,
    purchasedPackageId: string,
    scheduledAt: Date,
    durationMinutes: number = 60
  ) {
    // Verify the purchased package belongs to the student and is active
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        class_packages: {
          include: {
            teachers: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!purchasedPackage) {
      throw new Error("Package not found");
    }

    if (purchasedPackage.student_id !== studentId) {
      throw new Error("This package does not belong to you");
    }

    if (purchasedPackage.status !== "ACTIVE") {
      throw new Error("Package is not active");
    }

    // Check if there are remaining sessions
    const bookedSessions = await prisma.bookings.count({
      where: {
        purchased_package_id: purchasedPackageId,
        status: { notIn: ["CANCELLED"] }
      }
    });

    if (bookedSessions >= (purchasedPackage.class_packages?.classes_count ?? purchasedPackage.classes_total)) {
      throw new Error("All sessions from this package have been booked");
    }

    const teacherId = purchasedPackage.class_packages?.teacher_id ?? purchasedPackage.teacher_id;

    // Block bookings on dates the teacher marked unavailable
    const dateStr = scheduledAt.toISOString().split('T')[0];
    const unavailableMarker = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: new Date(dateStr),
        is_unavailable: true,
      },
    });
    if (unavailableMarker) {
      throw new Error('The teacher is unavailable on this date. Please choose a different date.');
    }

    // Check for existing bookings that overlap this time slot (prevent double-booking)
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    const existingBooking = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          lt: endTime,
          gte: new Date(scheduledAt.getTime() - 12 * 60 * 60 * 1000),
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
      },
    });

    if (existingBooking) {
      const bookingEnd = new Date(
        existingBooking.scheduled_at.getTime() +
        (existingBooking.duration_minutes || 60) * 60 * 1000
      );
      if (scheduledAt < bookingEnd && endTime > existingBooking.scheduled_at) {
        throw new Error("This time slot is already booked. Please pick a different time.");
      }
    }

    // Create the booking — package sessions go to PENDING_APPROVAL so teacher can accept/reschedule
    const booking = await prisma.bookings.create({
      data: {
        student_id: studentId,
        teacher_id: teacherId,
        purchased_package_id: purchasedPackageId,
        package_id: purchasedPackage.package_id,
        booking_type: "package_session",
        status: "PENDING_APPROVAL",
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        is_demo: false,
      },
      include: {
        students: {
          select: {
            id: true,
            name: true,
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
   * Check if a time slot is available for a specific duration
   */
  async isSlotAvailableForDuration(
    teacherId: string,
    scheduledAt: Date,
    durationMinutes: number
  ): Promise<boolean> {
    const dateStr = scheduledAt.toISOString().split("T")[0];
    const startTimeStr = scheduledAt.toTimeString().slice(0, 5); // HH:MM format
    
    // Calculate end time
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
    const endTimeStr = endTime.toTimeString().slice(0, 5);

    // Check if teacher has availability that covers this time range
    const availability = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: new Date(dateStr),
        is_unavailable: false,
        start_time: { lte: startTimeStr },
        end_time: { gte: endTimeStr },
      },
    });

    if (!availability) {
      return false;
    }

    // Check for existing bookings that overlap
    const existingBooking = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          lt: endTime,
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
        AND: {
          scheduled_at: {
            gte: new Date(scheduledAt.getTime() - 12 * 60 * 60 * 1000), // Check bookings that might overlap
          },
        },
      },
    });

    if (existingBooking) {
      // Check if this booking actually overlaps
      const bookingEnd = new Date(
        existingBooking.scheduled_at.getTime() + 
        (existingBooking.duration_minutes || 60) * 60 * 1000
      );
      
      if (scheduledAt < bookingEnd && endTime > existingBooking.scheduled_at) {
        return false;
      }
    }

    return true;
  }

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
    
    // Calculate end time for demo
    const endTime = new Date(scheduledAt.getTime() + DEMO_DURATION_MINUTES * 60 * 1000);

    // Check if teacher explicitly marked this date as unavailable
    const unavailable = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: new Date(dateStr),
        is_unavailable: true,
      },
    });

    if (unavailable) {
      return false;
    }

    // Check for existing bookings that overlap with this time slot
    const existingBooking = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        scheduled_at: {
          lt: endTime,
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
        AND: {
          scheduled_at: {
            gte: new Date(scheduledAt.getTime() - 12 * 60 * 60 * 1000),
          },
        },
      },
    });

    if (existingBooking) {
      const bookingEnd = new Date(
        existingBooking.scheduled_at.getTime() + 
        (existingBooking.duration_minutes || 60) * 60 * 1000
      );
      
      if (scheduledAt < bookingEnd && endTime > existingBooking.scheduled_at) {
        return false;
      }
    }

    return true;
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

    // Generate meeting link for the session
    const meetingId = nanoid(12);
    const meetingLink = `https://meet.jit.si/Maestera-Session-${meetingId}`;

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "SCHEDULED",
        meeting_link: meetingLink,
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

    if (booking.status !== "PENDING_APPROVAL" && booking.status !== "SCHEDULED") {
      throw new Error("Booking cannot be rescheduled in current status");
    }

    // Block if the teacher marked the new date as unavailable
    const dateStr = newScheduledAt.toISOString().split('T')[0];
    const unavailableMarker = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: teacherId,
        specific_date: new Date(dateStr),
        is_unavailable: true,
      },
    });
    if (unavailableMarker) {
      throw new Error('You have marked this date as unavailable. Remove the unavailable marker first.');
    }

    // Check for overlapping bookings at the new time (prevent double-booking)
    const durationMinutes = booking.duration_minutes || 60;
    const endTime = new Date(newScheduledAt.getTime() + durationMinutes * 60 * 1000);
    const overlapping = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        id: { not: bookingId }, // exclude the current booking
        scheduled_at: {
          lt: endTime,
          gte: new Date(newScheduledAt.getTime() - 12 * 60 * 60 * 1000),
        },
        status: {
          in: ["PENDING_APPROVAL", "SCHEDULED", "RESCHEDULE_PROPOSED"],
        },
      },
    });
    if (overlapping) {
      const overlapEnd = new Date(
        overlapping.scheduled_at.getTime() +
        (overlapping.duration_minutes || 60) * 60 * 1000
      );
      if (newScheduledAt < overlapEnd && endTime > overlapping.scheduled_at) {
        throw new Error('This time slot conflicts with another booking. Please pick a different time.');
      }
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
   * Get pending requests count for teacher (demos + package sessions)
   */
  async getPendingRequestsCount(teacherId: string): Promise<number> {
    return prisma.bookings.count({
      where: {
        teacher_id: teacherId,
        status: "PENDING_APPROVAL",
      },
    });
  }

  /**
   * Get student profile with class history for a teacher
   */
  async getStudentProfileForTeacher(teacherId: string, studentId: string) {
    // Verify teacher has bookings with this student
    const hasBookings = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
      },
    });

    if (!hasBookings) {
      throw new Error("Student not found or no bookings with this teacher");
    }

    // Get student info with profile for email
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    // Get profile for email
    const profile = await prisma.profiles.findUnique({
      where: { id: studentId },
      select: { name: true },
    });

    // Get all bookings between this teacher and student
    const bookings = await prisma.bookings.findMany({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
      },
      orderBy: { scheduled_at: "desc" },
    });

    // Calculate stats
    const completedBookings = bookings.filter(b => b.status === "COMPLETED");
    const scheduledBookings = bookings.filter(b => b.status === "SCHEDULED");
    const totalBookings = bookings.length;
    const attendance = totalBookings > 0 
      ? Math.round((completedBookings.length / totalBookings) * 100) 
      : 0;

    // Get next upcoming class
    const now = new Date();
    const nextBooking = scheduledBookings
      .filter(b => new Date(b.scheduled_at) > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

    // Get package progress if any
    const purchasedPackages = await prisma.purchased_packages.findMany({
      where: {
        student_id: studentId,
        status: "ACTIVE",
      },
      include: {
        class_packages: {
          select: {
            classes_count: true,
            teacher_id: true,
          },
        },
      },
    });

    const teacherPackage = purchasedPackages.find(
      p => p.class_packages?.teacher_id === teacherId
    );

    const packageProgress = teacherPackage
      ? {
          completed: teacherPackage.classes_completed || 0,
          total: teacherPackage.class_packages?.classes_count || 0,
        }
      : { completed: 0, total: 0 };

    // Format class history
    const classHistory = bookings.map(booking => ({
      id: booking.id,
      date: new Date(booking.scheduled_at).toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: `${new Date(booking.scheduled_at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })} - ${new Date(new Date(booking.scheduled_at).getTime() + (booking.duration_minutes || 60) * 60000).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`,
      topic: booking.is_demo ? "Demo Session" : "Class Session",
      status: booking.status.toLowerCase() as "completed" | "cancelled" | "missed",
      notes: booking.notes || undefined,
    }));

    return {
      id: student.id,
      name: student.name || profile?.name || "Unknown Student",
      email: undefined, // Email would require auth.users access
      age: student.date_of_birth 
        ? Math.floor((new Date().getTime() - new Date(student.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0,
      avatar: student.profile_picture_url,
      instrument: "Music", // Would need student instrument preferences
      level: "Intermediate" as const,
      progress: Math.min(100, Math.round((completedBookings.length / Math.max(1, totalBookings)) * 100)),
      learningGoals: [], // Would need separate goals table
      preferredSchedule: "", // Would need to store preferences
      guardianName: student.guardian_name || undefined,
      guardianPhone: student.guardian_phone || undefined,
      guardianEmail: undefined, // Not in schema
      packageProgress,
      attendance,
      nextClass: nextBooking
        ? {
            date: new Date(nextBooking.scheduled_at).toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: `${new Date(nextBooking.scheduled_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })} - ${new Date(new Date(nextBooking.scheduled_at).getTime() + (nextBooking.duration_minutes || 60) * 60000).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}`,
            mode: "online" as const,
            meetingLink: nextBooking.meeting_link,
          }
        : undefined,
      classHistory,
    };
  }
}

export const bookingService = new BookingService();
