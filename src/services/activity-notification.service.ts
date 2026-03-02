import prisma from "../config/database";
import {
  ActivityEvent,
  RecipientRole,
  WhatsAppNotificationService,
} from "./whatsapp-notification.service";

interface BookingNotificationOptions {
  bookingId: string;
  initiatedBy: RecipientRole;
  event:
    | "SESSION_SCHEDULED_BY_TEACHER"
    | "SESSION_SCHEDULED_BY_STUDENT"
    | "SESSION_RESCHEDULED_BY_TEACHER"
    | "SESSION_RESCHEDULED_BY_STUDENT"
    | "SESSION_CANCELLED_BY_TEACHER"
    | "SESSION_CANCELLED_BY_STUDENT";
}

export class ActivityNotificationService {
  private static formatDateTime(dateValue: Date): { date: string; time: string } {
    const date = new Date(dateValue);
    return {
      date: date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }

  private static async notifyRecipient(
    event: ActivityEvent,
    recipientRole: RecipientRole,
    recipientPhone: string | null | undefined,
    whatsappVerified: boolean,
    whatsappOptIn: boolean,
    variables: Record<string, string | number | boolean | null | undefined>
  ) {
    if (!recipientPhone || !whatsappVerified || !whatsappOptIn) return;

    try {
      await WhatsAppNotificationService.sendActivityNotification({
        event,
        recipientRole,
        recipientPhone,
        variables,
      });
    } catch (error) {
      console.error("[activity-notification] WhatsApp send failed:", error);
    }
  }

  private static async createTeacherInAppNotification(
    teacherId: string,
    title: string,
    message: string,
    type: string,
    section: string = "bookings"
  ) {
    try {
      await prisma.notifications.create({
        data: {
          teacher_id: teacherId,
          title,
          message,
          type,
          section,
          is_read: false,
        },
      });
    } catch (error) {
      console.error("[activity-notification] in-app notification create failed:", error);
    }
  }

  static async notifyBookingActivity(options: BookingNotificationOptions) {
    const booking = await prisma.bookings.findUnique({
      where: { id: options.bookingId },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    const actorLabel = options.initiatedBy === "teacher" ? "Teacher" : "Student";
    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const dateTime =
      booking.status === "RESCHEDULE_PROPOSED" && booking.rescheduled_at
        ? this.formatDateTime(booking.rescheduled_at)
        : this.formatDateTime(booking.scheduled_at);

    const commonVariables = {
      student_name: studentName,
      teacher_name: teacherName,
      session_date: dateTime.date,
      session_time: dateTime.time,
      initiated_by: actorLabel,
    };

    await Promise.allSettled([
      this.notifyRecipient(
        options.event,
        "teacher",
        booking.teachers.whatsapp_number,
        Boolean(booking.teachers.whatsapp_verified_at),
        booking.teachers.whatsapp_opt_in ?? true,
        commonVariables
      ),
      this.notifyRecipient(
        options.event,
        "student",
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        commonVariables
      ),
    ]);

    const inAppTitleMap: Record<BookingNotificationOptions["event"], string> = {
      SESSION_SCHEDULED_BY_TEACHER: "Session Scheduled",
      SESSION_SCHEDULED_BY_STUDENT: "New Session Request",
      SESSION_RESCHEDULED_BY_TEACHER: "Session Rescheduled",
      SESSION_RESCHEDULED_BY_STUDENT: "Reschedule Requested",
      SESSION_CANCELLED_BY_TEACHER: "Session Cancelled",
      SESSION_CANCELLED_BY_STUDENT: "Session Cancelled",
    };

    const inAppMessageMap: Record<BookingNotificationOptions["event"], string> = {
      SESSION_SCHEDULED_BY_TEACHER: `${teacherName} scheduled a class with ${studentName} on ${dateTime.date} at ${dateTime.time}.`,
      SESSION_SCHEDULED_BY_STUDENT: `${studentName} scheduled a class on ${dateTime.date} at ${dateTime.time}.`,
      SESSION_RESCHEDULED_BY_TEACHER: `${teacherName} proposed a reschedule to ${dateTime.date} at ${dateTime.time}.`,
      SESSION_RESCHEDULED_BY_STUDENT: `${studentName} proposed a reschedule to ${dateTime.date} at ${dateTime.time}.`,
      SESSION_CANCELLED_BY_TEACHER: `${teacherName} cancelled a session with ${studentName}.`,
      SESSION_CANCELLED_BY_STUDENT: `${studentName} cancelled a scheduled session.`,
    };

    await this.createTeacherInAppNotification(
      booking.teacher_id,
      inAppTitleMap[options.event],
      inAppMessageMap[options.event],
      options.event.toLowerCase()
    );
  }

  static async notifyPackagePurchased(purchasedPackageId: string) {
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        students: {
          select: {
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
          },
        },
      },
    });

    if (!purchasedPackage) {
      return;
    }

    const studentName = purchasedPackage.students.name || "Student";
    const teacherName = purchasedPackage.teachers.name || "Teacher";

    const variables = {
      student_name: studentName,
      teacher_name: teacherName,
      instrument: purchasedPackage.instrument || "Music",
      level: purchasedPackage.level || "-",
      mode: purchasedPackage.mode || "online",
      classes_total: purchasedPackage.classes_total,
      amount_paid: String(purchasedPackage.amount_paid),
    };

    await Promise.allSettled([
      this.notifyRecipient(
        "PACKAGE_PURCHASED",
        "teacher",
        purchasedPackage.teachers.whatsapp_number,
        Boolean(purchasedPackage.teachers.whatsapp_verified_at),
        purchasedPackage.teachers.whatsapp_opt_in ?? true,
        variables
      ),
      this.notifyRecipient(
        "PACKAGE_PURCHASED",
        "student",
        purchasedPackage.students.whatsapp_number,
        Boolean(purchasedPackage.students.whatsapp_verified_at),
        purchasedPackage.students.whatsapp_opt_in ?? true,
        variables
      ),
    ]);

    await this.createTeacherInAppNotification(
      purchasedPackage.teacher_id,
      "Package Purchased",
      `${studentName} purchased a ${purchasedPackage.classes_total}-session package (${purchasedPackage.instrument || "Music"}).`,
      "package_purchased",
      "payments"
    );
  }
}
