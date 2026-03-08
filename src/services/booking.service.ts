import prisma from "../config/database";
import { booking_status } from "@prisma/client";
import { nanoid } from 'nanoid';
import { ActivityNotificationService } from "./activity-notification.service";

// Demo class duration in minutes
const DEMO_DURATION_MINUTES = 30;

export class BookingService {
  /**
   * Check whether teacher has an overlapping active booking.
   */
  async hasTeacherBookingConflict(
    teacherId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeBookingId?: string
  ): Promise<boolean> {
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    const existingBooking = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
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
      select: {
        scheduled_at: true,
        duration_minutes: true,
      },
    });

    if (!existingBooking) {
      return false;
    }

    const bookingEnd = new Date(
      existingBooking.scheduled_at.getTime() +
        (existingBooking.duration_minutes || 60) * 60 * 1000
    );

    return scheduledAt < bookingEnd && endTime > existingBooking.scheduled_at;
  }

  /**
   * Get students who have purchased packages with this teacher,
   * including students with no bookings yet.
   */
  async getTeacherPackageStudents(teacherId: string) {
    const purchasedPackages = await prisma.purchased_packages.findMany({
      where: {
        teacher_id: teacherId,
        status: "ACTIVE",
      },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            profile_picture_url: true,
            date_of_birth: true,
          },
        },
      },
      orderBy: {
        purchased_at: "desc",
      },
    });

    if (purchasedPackages.length === 0) {
      return [];
    }

    const studentIds = Array.from(new Set(purchasedPackages.map((p) => p.student_id)));

    const [profiles, bookings] = await Promise.all([
      prisma.profiles.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true },
      }),
      prisma.bookings.findMany({
        where: {
          teacher_id: teacherId,
          student_id: { in: studentIds },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          student_id: true,
          purchased_package_id: true,
          status: true,
          scheduled_at: true,
          rescheduled_at: true,
        },
      }),
    ]);

    const profileNameById = new Map(profiles.map((p) => [p.id, p.name]));
    const bookingsByStudent = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const list = bookingsByStudent.get(booking.student_id) || [];
      list.push(booking);
      bookingsByStudent.set(booking.student_id, list);
    }

    const packageByStudent = new Map<string, (typeof purchasedPackages)[number]>();
    for (const purchasedPackage of purchasedPackages) {
      if (!packageByStudent.has(purchasedPackage.student_id)) {
        packageByStudent.set(purchasedPackage.student_id, purchasedPackage);
      }
    }

    return Array.from(packageByStudent.values()).map((purchasedPackage) => {
      const studentBookings = bookingsByStudent.get(purchasedPackage.student_id) || [];
      const packageBookings = studentBookings.filter(
        (booking: any) => (booking as any).purchased_package_id === purchasedPackage.id
      );
      const scheduledSessionsCount = packageBookings.length;
      const now = new Date();
      const upcomingBooking = packageBookings
        .filter((booking) => {
          const bookingDate =
            booking.status === "RESCHEDULE_PROPOSED" && booking.rescheduled_at
              ? booking.rescheduled_at
              : booking.scheduled_at;
          return bookingDate > now;
        })
        .sort((a, b) => {
          const aDate = a.status === "RESCHEDULE_PROPOSED" && a.rescheduled_at ? a.rescheduled_at : a.scheduled_at;
          const bDate = b.status === "RESCHEDULE_PROPOSED" && b.rescheduled_at ? b.rescheduled_at : b.scheduled_at;
          return aDate.getTime() - bDate.getTime();
        })[0];

      const dateOfBirth = purchasedPackage.students.date_of_birth;
      const age = dateOfBirth
        ? Math.floor(
            (Date.now() - new Date(dateOfBirth).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          )
        : 0;

      return {
        id: purchasedPackage.student_id,
        name:
          purchasedPackage.students.name ||
          profileNameById.get(purchasedPackage.student_id) ||
          "Unknown Student",
        avatar: purchasedPackage.students.profile_picture_url,
        age,
        instrument: purchasedPackage.instrument || "Music",
        learningStage: "Intermediate",
        mode: purchasedPackage.mode === "offline" ? "offline" : "online",
        status: purchasedPackage.classes_remaining > 0 ? "active" : "inactive",
        nextClassAt: upcomingBooking
          ? (
              upcomingBooking.status === "RESCHEDULE_PROPOSED" && upcomingBooking.rescheduled_at
                ? upcomingBooking.rescheduled_at
                : upcomingBooking.scheduled_at
            ).toISOString()
          : null,
        purchasedPackageId: purchasedPackage.id,
        packageStatus: purchasedPackage.status,
        classesRemaining: purchasedPackage.classes_remaining,
        classesTotal: purchasedPackage.classes_total,
        hasBookings: packageBookings.length > 0,
        scheduledSessionsCount,
      };
    });
  }

  /**
   * Teacher initiates scheduling for a student's purchased package.
   * Session stays in PENDING_APPROVAL until the student accepts.
   */
  async scheduleSessionByTeacher(
    teacherId: string,
    studentId: string,
    purchasedPackageId: string,
    scheduledAt: Date,
    durationMinutes: number = 60
  ) {
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
    });

    if (!purchasedPackage) {
      throw new Error("Package not found");
    }

    if (purchasedPackage.teacher_id !== teacherId) {
      throw new Error("Unauthorized package access");
    }

    if (purchasedPackage.student_id !== studentId) {
      throw new Error("Selected package does not belong to this student");
    }

    if (purchasedPackage.status !== "ACTIVE") {
      throw new Error("Package is not active");
    }

    const bookedSessions = await prisma.bookings.count({
      where: {
        purchased_package_id: purchasedPackageId,
        status: { notIn: ["CANCELLED"] },
      },
    });

    if (bookedSessions >= purchasedPackage.classes_total) {
      throw new Error("All sessions from this package have been booked");
    }

    const hasConflict = await this.hasTeacherBookingConflict(
      teacherId,
      scheduledAt,
      durationMinutes
    );
    if (hasConflict) {
      throw new Error("This time slot conflicts with another booking. Please choose a different time.");
    }

    const meetingId = nanoid(12);
    const meetingLink = `https://meet.jit.si/Maestera-Session-${meetingId}`;

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
        meeting_link: meetingLink,
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

    void ActivityNotificationService.notifyBookingActivity({
      bookingId: booking.id,
      initiatedBy: "teacher",
      event: "SESSION_SCHEDULED_BY_TEACHER",
    }).catch((error) => {
      console.error("Failed to send schedule notification (teacher-initiated):", error);
    });

    return booking;
  }

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

    void ActivityNotificationService.notifyBookingActivity({
      bookingId: booking.id,
      initiatedBy: "student",
      event: "SESSION_SCHEDULED_BY_STUDENT",
    }).catch((error) => {
      console.error("Failed to send schedule notification (student-initiated):", error);
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

    const hasConflict = await this.hasTeacherBookingConflict(
      teacherId,
      scheduledAt,
      durationMinutes
    );

    return !hasConflict;
  }

  /**
   * Request a demo class (student -> teacher)
   * Creates a booking with PENDING_APPROVAL status
   */
  async requestDemo(
    studentId: string,
    teacherId: string,
    scheduledAt: Date,
    notes?: string,
    instrument?: string
  ) {
    // Ensure student record exists
    const student = await prisma.students.findUnique({
      where: { id: studentId },
      select: { id: true },
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
        booking_type: instrument ? `demo:${instrument}` : "demo",
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

    // Notify teacher about the demo request
    void ActivityNotificationService.notifyDemoRequested(booking.id).catch((error) => {
      console.error('Failed to send demo request notification:', error);
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
   * Counterparty accepts a pending booking request
   */
  async acceptBooking(bookingId: string, userId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const isTeacher = booking.teacher_id === userId;
    const isStudent = booking.student_id === userId;

    if (!isTeacher && !isStudent) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "PENDING_APPROVAL") {
      throw new Error("Booking cannot be accepted in current status");
    }

    if (booking.booking_type === "demo" && !isTeacher) {
      throw new Error("Only teacher can accept demo requests");
    }

    if (booking.booking_type !== "demo") {
      const teacherInitiated = Boolean(booking.meeting_link);
      if (teacherInitiated && !isStudent) {
        throw new Error("Only student can accept this session request");
      }
      if (!teacherInitiated && !isTeacher) {
        throw new Error("Only teacher can accept this session request");
      }
    }

    // Generate meeting link for the session
    const meetingId = nanoid(12);
    const meetingLink = booking.meeting_link || `https://meet.jit.si/Maestera-Session-${meetingId}`;

    const updatedBooking = await prisma.bookings.update({
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

    // Send approval notifications
    if (booking.is_demo) {
      void ActivityNotificationService.notifyDemoApproved(updatedBooking.id).catch((error) => {
        console.error('Failed to send demo approval notification:', error);
      });
    } else {
      // Regular session accepted: notify both sides
      const initiatedBy = isTeacher ? "teacher" : "student";
      const event = initiatedBy === "teacher"
        ? "SESSION_SCHEDULED_BY_TEACHER"
        : "SESSION_SCHEDULED_BY_STUDENT";
      void ActivityNotificationService.notifyBookingActivity({
        bookingId: updatedBooking.id,
        initiatedBy,
        event,
      }).catch((error) => {
        console.error('Failed to send accept notification:', error);
      });
    }

    return updatedBooking;
  }

  /**
   * Teacher proposes a new time (reschedule)
   */
  async rescheduleBooking(
    bookingId: string,
    userId: string,
    newScheduledAt: Date
  ) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.teacher_id !== userId && booking.student_id !== userId) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "PENDING_APPROVAL" && booking.status !== "SCHEDULED" && booking.status !== "RESCHEDULE_PROPOSED") {
      throw new Error("Booking cannot be rescheduled in current status");
    }

    // Block if the teacher marked the new date as unavailable
    const dateStr = newScheduledAt.toISOString().split('T')[0];
    const unavailableMarker = await prisma.teacher_availability.findFirst({
      where: {
        teacher_id: booking.teacher_id,
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
        teacher_id: booking.teacher_id,
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

    const updatedBooking = await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "RESCHEDULE_PROPOSED",
        rescheduled_at: newScheduledAt,
        rescheduled_by: userId,
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

    const initiatedBy = booking.teacher_id === userId ? "teacher" : "student";

    if (booking.is_demo) {
      // Demo reschedule has its own templates
      void ActivityNotificationService.notifyDemoRescheduled(updatedBooking.id, initiatedBy).catch((error) => {
        console.error("Failed to send demo reschedule notification:", error);
      });
    } else {
      const event = initiatedBy === "teacher"
        ? "SESSION_RESCHEDULED_BY_TEACHER"
        : "SESSION_RESCHEDULED_BY_STUDENT";

      void ActivityNotificationService.notifyBookingActivity({
        bookingId: updatedBooking.id,
        initiatedBy,
        event,
      }).catch((error) => {
        console.error("Failed to send reschedule notification:", error);
      });
    }

    return updatedBooking;
  }

  /**
   * Student confirms the rescheduled time
   */
  async confirmReschedule(bookingId: string, userId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const isTeacher = booking.teacher_id === userId;
    const isStudent = booking.student_id === userId;

    if (!isTeacher && !isStudent) {
      throw new Error("Unauthorized");
    }

    if (booking.status !== "RESCHEDULE_PROPOSED") {
      throw new Error("No reschedule to confirm");
    }

    if (!booking.rescheduled_at) {
      throw new Error("No rescheduled time found");
    }

    if (booking.rescheduled_by === userId) {
      throw new Error("You cannot confirm your own reschedule proposal");
    }

    const updatedReschedule = await prisma.bookings.update({
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

    // Notifications for reschedule confirmation
    const confirmedBy = isTeacher ? "teacher" : "student";
    if (booking.is_demo) {
      void ActivityNotificationService.notifyDemoRescheduleConfirmed(updatedReschedule.id, confirmedBy).catch((error) => {
        console.error('Failed to send demo reschedule confirmed notification:', error);
      });
    } else {
      const initiatedBy = confirmedBy;
      const event = initiatedBy === "teacher"
        ? "SESSION_RESCHEDULED_BY_TEACHER"
        : "SESSION_RESCHEDULED_BY_STUDENT";
      void ActivityNotificationService.notifyBookingActivity({
        bookingId: updatedReschedule.id,
        initiatedBy: initiatedBy as "teacher" | "student",
        event,
      }).catch((error) => {
        console.error('Failed to send reschedule confirm notification:', error);
      });
    }

    return updatedReschedule;
  }

  /**
   * Teacher marks a class as completed (attendance)
   */
  async markBookingCompleted(bookingId: string, teacherId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.teacher_id !== teacherId) {
      throw new Error("Unauthorized");
    }

    if (booking.status === "COMPLETED") {
      throw new Error("Booking is already marked as completed");
    }

    if (booking.status !== "SCHEDULED") {
      throw new Error("Only scheduled classes can be marked as completed");
    }

    if (new Date(booking.scheduled_at) > new Date()) {
      throw new Error("You can only mark attendance for classes that have already started");
    }

    return prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
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

      if (booking.purchased_package_id) {
        const purchasedPackage = await tx.purchased_packages.findUnique({
          where: { id: booking.purchased_package_id },
          select: {
            id: true,
            classes_completed: true,
            classes_total: true,
          },
        });

        if (purchasedPackage && purchasedPackage.classes_completed < purchasedPackage.classes_total) {
          await tx.purchased_packages.update({
            where: { id: purchasedPackage.id },
            data: {
              classes_completed: { increment: 1 },
            },
          });

          // Check if all sessions are now completed
          const newCompleted = purchasedPackage.classes_completed + 1;
          if (newCompleted >= purchasedPackage.classes_total) {
            void ActivityNotificationService.notifyAllSessionsCompleted(purchasedPackage.id).catch((error) => {
              console.error('Failed to send all-sessions-completed notification:', error);
            });
          }
        }
      }

      // Send attendance present email
      void ActivityNotificationService.notifyAttendancePresent(bookingId).catch((error) => {
        console.error('Failed to send attendance present notification:', error);
      });

      return updatedBooking;
    });
  }

  /**
   * Teacher marks a class as absent (attendance)
   */
  async markBookingAbsent(bookingId: string, teacherId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.teacher_id !== teacherId) {
      throw new Error("Unauthorized");
    }

    if ((booking.status as string) === "ABSENT") {
      throw new Error("Booking is already marked as absent");
    }

    if (booking.status !== "SCHEDULED") {
      throw new Error("Only scheduled classes can be marked as absent");
    }

    if (new Date(booking.scheduled_at) > new Date()) {
      throw new Error("You can only mark attendance for classes that have already started");
    }

    return prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: bookingId },
        data: {
          status: "ABSENT" as any,
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

      if (booking.purchased_package_id) {
        const purchasedPackage = await tx.purchased_packages.findUnique({
          where: { id: booking.purchased_package_id },
          select: {
            id: true,
            classes_completed: true,
            classes_total: true,
          },
        });

        if (purchasedPackage && purchasedPackage.classes_completed < purchasedPackage.classes_total) {
          await tx.purchased_packages.update({
            where: { id: purchasedPackage.id },
            data: {
              classes_completed: { increment: 1 },
            },
          });

          // Check if all sessions are now completed
          const newCompleted = purchasedPackage.classes_completed + 1;
          if (newCompleted >= purchasedPackage.classes_total) {
            void ActivityNotificationService.notifyAllSessionsCompleted(purchasedPackage.id).catch((error) => {
              console.error('Failed to send all-sessions-completed notification:', error);
            });
          }
        }
      }

      // Send attendance absent email
      void ActivityNotificationService.notifyAttendanceAbsent(bookingId).catch((error) => {
        console.error('Failed to send attendance absent notification:', error);
      });

      return updatedBooking;
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

    const cancelledBooking = await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        updated_at: new Date(),
      },
    });

    const initiatedBy = booking.teacher_id === userId ? "teacher" : "student";

    if (booking.is_demo) {
      // Demo cancellation has its own templates
      void ActivityNotificationService.notifyDemoCancelled(cancelledBooking.id, initiatedBy).catch((error) => {
        console.error("Failed to send demo cancel notification:", error);
      });
    } else {
      const event = initiatedBy === "teacher"
        ? "SESSION_CANCELLED_BY_TEACHER"
        : "SESSION_CANCELLED_BY_STUDENT";

      void ActivityNotificationService.notifyBookingActivity({
        bookingId: cancelledBooking.id,
        initiatedBy,
        event,
      }).catch((error) => {
        console.error("Failed to send cancel notification:", error);
      });
    }

    return cancelledBooking;
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
    const teacherPackage = await prisma.purchased_packages.findFirst({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
        status: {
          in: ["ACTIVE", "PAUSED"],
        },
      },
      orderBy: { purchased_at: "desc" },
    });

    // Verify teacher has either package relation or booking relation with this student
    const hasBookings = await prisma.bookings.findFirst({
      where: {
        teacher_id: teacherId,
        student_id: studentId,
      },
    });

    if (!teacherPackage && !hasBookings) {
      throw new Error("Student not found or no bookings with this teacher");
    }

    // Get student info with profile for email
    const student = await prisma.students.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        date_of_birth: true,
        profile_picture_url: true,
        guardian_name: true,
        guardian_phone: true,
      },
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
        ...(teacherPackage ? { purchased_package_id: teacherPackage.id } : {}),
      },
      orderBy: { scheduled_at: "desc" },
    });

    // Exclude demo/cancelled bookings from slot consumption stats
    const packageBookings = bookings.filter((b) => !b.is_demo && b.status !== "CANCELLED");

    // Calculate stats (only for package bookings)
    const completedBookings = packageBookings.filter(b => b.status === "COMPLETED");
    const scheduledBookings = packageBookings.filter(b => b.status === "SCHEDULED");
    const totalBookings = packageBookings.length;
    const attendance = totalBookings > 0 
      ? Math.round((completedBookings.length / totalBookings) * 100) 
      : 0;

    // Get next upcoming class
    const now = new Date();
    const nextBooking = scheduledBookings
      .filter(b => new Date(b.scheduled_at) > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

    const packageProgress = teacherPackage
      ? {
          completed: teacherPackage.classes_completed || 0,
          total: teacherPackage.classes_total || 0,
        }
      : { completed: 0, total: 0 };

    // Format class history
    const classHistory = bookings.map(booking => {
      // Use rescheduled_at if the booking has been rescheduled, otherwise use scheduled_at
      const displayDate = booking.status === "RESCHEDULE_PROPOSED" && booking.rescheduled_at 
        ? booking.rescheduled_at 
        : booking.scheduled_at;
      const displayStart = new Date(displayDate);
      const displayEnd = new Date(displayStart.getTime() + (booking.duration_minutes || 60) * 60000);
      
      return {
        id: booking.id,
        starts_at: displayStart.toISOString(),
        ends_at: displayEnd.toISOString(),
        date: displayStart.toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: `${displayStart.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })} - ${displayEnd.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}`,
        topic: booking.is_demo ? "Demo Session" : "Class Session",
        status: booking.status === "RESCHEDULE_PROPOSED"
          ? "reschedule_proposed"
          : (booking.status.toLowerCase() as "completed" | "cancelled" | "missed" | "scheduled" | "pending_approval" | "absent"),
        rescheduled_by: booking.rescheduled_by || null,
        notes: booking.notes || undefined,
        meetingLink: booking.meeting_link || undefined,
      };
    });

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
      purchasedPackageId: teacherPackage?.id,
      packageProgress,
      attendance,
      nextClass: nextBooking
        ? {
            starts_at: new Date(
              nextBooking.status === "RESCHEDULE_PROPOSED" && nextBooking.rescheduled_at
                ? nextBooking.rescheduled_at
                : nextBooking.scheduled_at
            ).toISOString(),
            ends_at: new Date(
              new Date(
                nextBooking.status === "RESCHEDULE_PROPOSED" && nextBooking.rescheduled_at
                  ? nextBooking.rescheduled_at
                  : nextBooking.scheduled_at
              ).getTime() + (nextBooking.duration_minutes || 60) * 60000
            ).toISOString(),
            date: new Date(nextBooking.status === "RESCHEDULE_PROPOSED" && nextBooking.rescheduled_at 
              ? nextBooking.rescheduled_at 
              : nextBooking.scheduled_at).toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: (() => {
              const displayDate = nextBooking.status === "RESCHEDULE_PROPOSED" && nextBooking.rescheduled_at 
                ? nextBooking.rescheduled_at 
                : nextBooking.scheduled_at;
              return `${new Date(displayDate).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - ${new Date(new Date(displayDate).getTime() + (nextBooking.duration_minutes || 60) * 60000).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}`;
            })(),
            mode: "online" as const,
            meetingLink: nextBooking.meeting_link,
          }
        : undefined,
      classHistory,
    };
  }
}

export const bookingService = new BookingService();
