import prisma from "../config/database";
import {
  ActivityEvent,
  RecipientRole,
  WhatsAppNotificationService,
} from "./whatsapp-notification.service";
import { queueEmail } from "./email-queue.service";
import { NotificationTemplateService } from "./notification-template.service";

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

/**
 * Maps booking events → student-side DB template trigger_key for email.
 * Teacher-side email trigger keys are resolved separately when needed.
 */
const STUDENT_EMAIL_TRIGGER_MAP: Record<BookingNotificationOptions["event"], string> = {
  SESSION_SCHEDULED_BY_TEACHER: "SESSION_PROPOSED_BY_TEACHER", // student gets "teacher proposed a session"
  SESSION_SCHEDULED_BY_STUDENT: "SESSION_APPROVED_BY_TEACHER", // student gets confirmation after teacher approves
  SESSION_RESCHEDULED_BY_TEACHER: "SESSION_RESCHEDULE_APPROVED_BY_TEACHER",
  SESSION_RESCHEDULED_BY_STUDENT: "SESSION_RESCHEDULE_APPROVED_BY_TEACHER",
  SESSION_CANCELLED_BY_TEACHER: "SESSION_CANCELLED_BY_TEACHER",
  SESSION_CANCELLED_BY_STUDENT: "SESSION_CANCELLED_BY_STUDENT",
};

const TEACHER_EMAIL_TRIGGER_MAP: Partial<Record<BookingNotificationOptions["event"], string>> = {
  SESSION_SCHEDULED_BY_STUDENT: "TEACHER_SESSION_PROPOSED_BY_STUDENT",
  SESSION_RESCHEDULED_BY_STUDENT: "TEACHER_SESSION_RESCHEDULED_BY_STUDENT",
  SESSION_CANCELLED_BY_STUDENT: "TEACHER_SESSION_CANCELLED_BY_STUDENT",
  SESSION_CANCELLED_BY_TEACHER: "LESSON_SCHEDULED_FOR_TEACHER", // no specific cancel-confirm template; skip
};

export class ActivityNotificationService {
  private static DISPLAY_TIMEZONE = "Asia/Kolkata";
  private static DASHBOARD_URL = process.env.STUDENT_DASHBOARD_URL || "https://maestera.com";

  private static SCHEDULE_OR_RESCHEDULE_EVENTS: ReadonlySet<BookingNotificationOptions["event"]> = new Set([
    "SESSION_SCHEDULED_BY_TEACHER",
    "SESSION_SCHEDULED_BY_STUDENT",
    "SESSION_RESCHEDULED_BY_TEACHER",
    "SESSION_RESCHEDULED_BY_STUDENT",
  ]);

  private static formatDateTime(
    dateValue: Date,
    durationMinutes: number = 60
  ): { date: string; time: string } {
    const start = new Date(dateValue);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const formatTime = (value: Date) =>
      value.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: this.DISPLAY_TIMEZONE,
      });

    return {
      date: start.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: this.DISPLAY_TIMEZONE,
      }),
      time: `${formatTime(start)} - ${formatTime(end)}`,
    };
  }

  /** Replace {{Variable}} placeholders with values */
  private static interpolate(
    template: string,
    variables: Record<string, string>
  ): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, key) => variables[key.trim()] ?? "");
  }

  /** Wrap plain-text body in a minimal HTML layout for email */
  private static wrapEmailHtml(subject: string, body: string): string {
    const htmlBody = body.replace(/\n/g, "<br>");
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;">
        <h2 style="margin:0 0 12px;">${subject}</h2>
        <p style="margin:0 0 12px;">${htmlBody}</p>
      </div>
    `;
  }

  /** Derive a human-readable title from an event name */
  private static eventToTitle(event: string): string {
    return event
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
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

  /**
   * Send an email rendered from a DB template.
   * Skips silently when the template is missing, inactive, or has no email content.
   */
  private static async sendTemplateEmail(
    recipientEmail: string | null | undefined,
    triggerKey: string,
    variables: Record<string, string>
  ) {
    if (!recipientEmail) return;

    try {
      const tpl = await NotificationTemplateService.getTemplate(triggerKey);
      if (!tpl || !tpl.is_active) {
        console.warn(`[activity-notification] Template "${triggerKey}" not found or inactive — skipping email`);
        return;
      }

      if (!tpl.email_subject || !tpl.email_body) {
        console.warn(`[activity-notification] Template "${triggerKey}" has no email content — skipping`);
        return;
      }

      const subject = this.interpolate(tpl.email_subject, variables);
      const body = this.interpolate(tpl.email_body, variables);

      await queueEmail({
        to: recipientEmail,
        subject,
        html: this.wrapEmailHtml(subject, body),
      });
    } catch (error) {
      console.error("[activity-notification] template email send failed:", error);
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
        purchased_packages: { select: { instrument: true, mode: true } },
        students: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
      },
    });

    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = booking.purchased_packages?.instrument || "Music";
    const dateTime =
      booking.status === "RESCHEDULE_PROPOSED" && booking.rescheduled_at
        ? this.formatDateTime(booking.rescheduled_at, booking.duration_minutes || 60)
        : this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 60);

    // Variables for WhatsApp (11za flat object)
    const whatsappVars = {
      student_name: studentName,
      teacher_name: teacherName,
      session_date: dateTime.date,
      session_time: dateTime.time,
      initiated_by: options.initiatedBy === "teacher" ? "Teacher" : "Student",
    };

    // Variables matching DB template {{Placeholder}} format
    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      Mode: booking.purchased_packages?.mode || "Online",
      "Dashboard Link": this.DASHBOARD_URL,
      Link: this.DASHBOARD_URL,
      "Teacher Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    const studentTrigger = STUDENT_EMAIL_TRIGGER_MAP[options.event];
    const teacherTrigger = TEACHER_EMAIL_TRIGGER_MAP[options.event];
    const isScheduleOrReschedule = this.SCHEDULE_OR_RESCHEDULE_EVENTS.has(options.event);

    const studentEmail = booking.students.profiles?.users?.email;
    const teacherEmail = booking.teachers.profiles?.users?.email;

    if (isScheduleOrReschedule) {
      // WhatsApp → counterpart, Email → both sides (from DB templates)
      const counterpartRole: RecipientRole =
        options.initiatedBy === "teacher" ? "student" : "teacher";

      const counterpart =
        counterpartRole === "teacher"
          ? {
              phone: booking.teachers.whatsapp_number,
              verified: Boolean(booking.teachers.whatsapp_verified_at),
              optIn: booking.teachers.whatsapp_opt_in ?? true,
            }
          : {
              phone: booking.students.whatsapp_number,
              verified: Boolean(booking.students.whatsapp_verified_at),
              optIn: booking.students.whatsapp_opt_in ?? true,
            };

      await Promise.allSettled([
        this.notifyRecipient(
          options.event,
          counterpartRole,
          counterpart.phone,
          counterpart.verified,
          counterpart.optIn,
          whatsappVars
        ),
        this.sendTemplateEmail(studentEmail, studentTrigger, templateVars),
        teacherTrigger
          ? this.sendTemplateEmail(teacherEmail, teacherTrigger, templateVars)
          : Promise.resolve(),
      ]);
    } else {
      // Cancellation — WhatsApp to both + email to both via templates
      await Promise.allSettled([
        this.notifyRecipient(
          options.event,
          "teacher",
          booking.teachers.whatsapp_number,
          Boolean(booking.teachers.whatsapp_verified_at),
          booking.teachers.whatsapp_opt_in ?? true,
          whatsappVars
        ),
        this.notifyRecipient(
          options.event,
          "student",
          booking.students.whatsapp_number,
          Boolean(booking.students.whatsapp_verified_at),
          booking.students.whatsapp_opt_in ?? true,
          whatsappVars
        ),
        this.sendTemplateEmail(studentEmail, studentTrigger, templateVars),
        teacherTrigger
          ? this.sendTemplateEmail(teacherEmail, teacherTrigger, templateVars)
          : Promise.resolve(),
      ]);
    }

    // Teacher in-app notification — title & message derived dynamically
    const inAppTitle = this.eventToTitle(options.event);
    const inAppMessage = `${instrument} session with ${studentName} — ${dateTime.date}, ${dateTime.time}`;

    await this.createTeacherInAppNotification(
      booking.teacher_id,
      inAppTitle,
      inAppMessage,
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
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
      },
    });

    if (!purchasedPackage) return;

    const studentName = purchasedPackage.students.name || "Student";
    const teacherName = purchasedPackage.teachers.name || "Teacher";
    const instrument = purchasedPackage.instrument || "Music";

    const whatsappVars = {
      student_name: studentName,
      teacher_name: teacherName,
      instrument,
      level: purchasedPackage.level || "-",
      mode: purchasedPackage.mode || "online",
      classes_total: purchasedPackage.classes_total,
      amount_paid: String(purchasedPackage.amount_paid),
    };

    const firstSession = await prisma.bookings.findFirst({
      where: {
        purchased_package_id: purchasedPackage.id,
        duration_minutes: { not: null },
      },
      select: { duration_minutes: true },
      orderBy: { scheduled_at: "asc" },
    });

    const lessonDurationMinutes = firstSession?.duration_minutes || 60;

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Mode: purchasedPackage.mode || "Online",
      Level: purchasedPackage.level || "Beginner",
      "Duration of lesson": `${lessonDurationMinutes} mins`,
      "Fee per lesson": String(purchasedPackage.price_per_session),
      "Number of Lessons": String(purchasedPackage.classes_total),
      Date: purchasedPackage.purchased_at
        ? this.formatDateTime(purchasedPackage.purchased_at, 60).date
        : this.formatDateTime(new Date(), 60).date,
      "Amount Paid": String(purchasedPackage.amount_paid),
      "Schedule Link": this.DASHBOARD_URL,
    };

    await Promise.allSettled([
      this.notifyRecipient(
        "PACKAGE_PURCHASED",
        "teacher",
        purchasedPackage.teachers.whatsapp_number,
        Boolean(purchasedPackage.teachers.whatsapp_verified_at),
        purchasedPackage.teachers.whatsapp_opt_in ?? true,
        whatsappVars
      ),
      this.notifyRecipient(
        "PACKAGE_PURCHASED",
        "student",
        purchasedPackage.students.whatsapp_number,
        Boolean(purchasedPackage.students.whatsapp_verified_at),
        purchasedPackage.students.whatsapp_opt_in ?? true,
        whatsappVars
      ),
      this.sendTemplateEmail(
        purchasedPackage.students.profiles?.users?.email,
        "PAYMENT_SUCCESS",
        templateVars
      ),
    ]);

    // Teacher in-app notification — derived dynamically
    await this.createTeacherInAppNotification(
      purchasedPackage.teacher_id,
      "Package Purchased",
      `${studentName} purchased a ${purchasedPackage.classes_total}-session ${instrument} package.`,
      "package_purchased",
      "payments"
    );

    // Also send LESSON_SCHEDULED_FOR_TEACHER email to teacher
    const teacherEmail = purchasedPackage.teachers.profiles?.users?.email;
    if (teacherEmail) {
      await this.sendTemplateEmail(teacherEmail, "LESSON_SCHEDULED_FOR_TEACHER", {
        "Teacher Name": teacherName,
        "Student Name": studentName,
        Instrument: instrument,
        Number: String(purchasedPackage.classes_total),
        Mode: purchasedPackage.mode || "online",
        "Teacher Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
      });
    }
  }

  // ────────────────────────────────────────────────────────
  // Demo booking notifications
  // ────────────────────────────────────────────────────────

  /**
   * When student requests a demo → notify teacher
   */
  static async notifyDemoRequested(bookingId: string) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 30);

    const templateVars: Record<string, string> = {
      "Teacher Name": teacherName,
      "Student Name": studentName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    const teacherEmail = booking.teachers.profiles?.users?.email;

    await Promise.allSettled([
      this.sendTemplateEmail(teacherEmail, "TEACHER_DEMO_REQUESTED", templateVars),
      this.sendTemplateWhatsApp(
        booking.teachers.whatsapp_number,
        Boolean(booking.teachers.whatsapp_verified_at),
        booking.teachers.whatsapp_opt_in ?? true,
        "TEACHER_DEMO_REQUESTED",
        templateVars
      ),
    ]);

    await this.createTeacherInAppNotification(
      booking.teacher_id,
      "New Demo Request",
      `${studentName} requested a ${instrument} demo session`,
      "demo_requested"
    );
  }

  /**
   * When teacher approves a demo → notify both
   */
  static async notifyDemoApproved(bookingId: string) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 30);

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      Link: this.DASHBOARD_URL,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    const studentEmail = booking.students.profiles?.users?.email;
    const teacherEmail = booking.teachers.profiles?.users?.email;

    await Promise.allSettled([
      // Student: email + whatsapp (DEMO_SCHEDULED_AFTER_TEACHER_APPROVAL)
      this.sendTemplateEmail(studentEmail, "DEMO_SCHEDULED_AFTER_TEACHER_APPROVAL", templateVars),
      this.sendTemplateWhatsApp(
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        "DEMO_SCHEDULED_AFTER_TEACHER_APPROVAL",
        templateVars
      ),
      // Teacher: email (TEACHER_DEMO_APPROVED)
      this.sendTemplateEmail(teacherEmail, "TEACHER_DEMO_APPROVED", templateVars),
    ]);
  }

  /**
   * When demo is cancelled → notify both
   */
  static async notifyDemoCancelled(bookingId: string, cancelledBy: "teacher" | "student") {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 30);

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      Link: this.DASHBOARD_URL,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    await Promise.allSettled([
      // Student: DEMO_CANCELLED whatsapp
      this.sendTemplateWhatsApp(
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        "DEMO_CANCELLED",
        templateVars
      ),
      // Teacher: TEACHER_DEMO_CANCELLED_BY_STUDENT whatsapp (if student cancelled)
      cancelledBy === "student"
        ? this.sendTemplateWhatsApp(
            booking.teachers.whatsapp_number,
            Boolean(booking.teachers.whatsapp_verified_at),
            booking.teachers.whatsapp_opt_in ?? true,
            "TEACHER_DEMO_CANCELLED_BY_STUDENT",
            templateVars
          )
        : Promise.resolve(),
    ]);
  }

  /**
   * When demo is rescheduled → notify counterpart
   */
  static async notifyDemoRescheduled(bookingId: string, rescheduledBy: "teacher" | "student") {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = booking.rescheduled_at
      ? this.formatDateTime(booking.rescheduled_at, booking.duration_minutes || 30)
      : this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 30);

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      Link: this.DASHBOARD_URL,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    if (rescheduledBy === "student") {
      // Notify teacher via WhatsApp
      await this.sendTemplateWhatsApp(
        booking.teachers.whatsapp_number,
        Boolean(booking.teachers.whatsapp_verified_at),
        booking.teachers.whatsapp_opt_in ?? true,
        "TEACHER_DEMO_RESCHEDULED_BY_STUDENT",
        templateVars
      );
    } else {
      // Teacher rescheduled → notify student via WhatsApp
      await this.sendTemplateWhatsApp(
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        "DEMO_NEW_PROPOSED_TIME",
        templateVars
      );
    }
  }

  /**
   * When a demo reschedule is confirmed by counterpart
   */
  static async notifyDemoRescheduleConfirmed(bookingId: string, confirmedBy: "teacher" | "student") {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 30);

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      Link: this.DASHBOARD_URL,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    if (confirmedBy === "student") {
      // Student approved teacher's reschedule → notify teacher
      const teacherEmail = booking.teachers.profiles?.users?.email;
      await Promise.allSettled([
        this.sendTemplateWhatsApp(
          booking.teachers.whatsapp_number,
          Boolean(booking.teachers.whatsapp_verified_at),
          booking.teachers.whatsapp_opt_in ?? true,
          "TEACHER_DEMO_RESCHEDULED_CONFIRMED",
          templateVars
        ),
        this.sendTemplateEmail(teacherEmail, "TEACHER_DEMO_RESCHEDULED_CONFIRMED_BY_STUDENT", templateVars),
      ]);
    } else {
      // Teacher approved student's reschedule → notify student
      const studentEmail = booking.students.profiles?.users?.email;
      await Promise.allSettled([
        this.sendTemplateWhatsApp(
          booking.students.whatsapp_number,
          Boolean(booking.students.whatsapp_verified_at),
          booking.students.whatsapp_opt_in ?? true,
          "DEMO_RESCHEDULED_AFTER_TEACHER_APPROVAL",
          templateVars
        ),
        this.sendTemplateEmail(studentEmail, "DEMO_SCHEDULED_AFTER_TEACHER_APPROVAL", templateVars),
      ]);
    }
  }

  /**
   * Post-demo follow-up (after demo session time has passed)
   */
  static async notifyPostDemo(bookingId: string) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Link: this.DASHBOARD_URL,
    };

    const studentEmail = booking.students.profiles?.users?.email;

    await Promise.allSettled([
      this.sendTemplateEmail(studentEmail, "DEMO_POST_SESSION", templateVars),
      this.sendTemplateWhatsApp(
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        "DEMO_POST_SESSION",
        templateVars
      ),
    ]);
  }

  // ────────────────────────────────────────────────────────
  // Signup & preferences notifications
  // ────────────────────────────────────────────────────────

  /**
   * Welcome email on student signup
   */
  static async notifyStudentSignup(studentId: string, studentName: string, email: string) {
    await this.sendTemplateEmail(email, "STUDENT_SIGNUP_WELCOME", {
      "Student Name": studentName,
      "Browse Teachers Link": `${this.DASHBOARD_URL}/find-teacher`,
    });
  }

  /**
   * Welcome email on teacher signup
   */
  static async notifyTeacherSignup(teacherId: string, teacherName: string, email: string) {
    await this.sendTemplateEmail(email, "TEACHER_SIGNUP_WELCOME", {
      "Teacher Name": teacherName,
      "Teacher Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    });
  }

  /**
   * Preferences received confirmation
   */
  static async notifyPreferencesReceived(
    email: string,
    vars: {
      studentName: string;
      instrument: string;
      mode: string;
      feeRange: string;
      level: string;
      learningGoals: string;
    }
  ) {
    await this.sendTemplateEmail(email, "STUDENT_PREFERENCES_RECEIVED", {
      "Student Name": vars.studentName,
      Instrument: vars.instrument,
      Mode: vars.mode,
      "Fee Range": vars.feeRange,
      Level: vars.level,
      "Learning Goals": vars.learningGoals,
    });
  }

  // ────────────────────────────────────────────────────────
  // Attendance notifications
  // ────────────────────────────────────────────────────────

  /**
   * Attendance marked present
   */
  static async notifyAttendancePresent(bookingId: string) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking || !booking.purchased_package_id) return;

    const stats = await this.getPackageStats(booking.purchased_package_id);
    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const studentEmail = booking.students.profiles?.users?.email;

    await this.sendTemplateEmail(studentEmail, "ATTENDANCE_MARKED_PRESENT", {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      X: String(stats.completed),
      Y: String(stats.missed),
      Z: String(stats.remaining),
      "Schedule Link": this.DASHBOARD_URL,
    });
  }

  /**
   * Attendance marked absent
   */
  static async notifyAttendanceAbsent(bookingId: string) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking || !booking.purchased_package_id) return;

    const stats = await this.getPackageStats(booking.purchased_package_id);
    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 60);
    const studentEmail = booking.students.profiles?.users?.email;

    await this.sendTemplateEmail(studentEmail, "ATTENDANCE_MARKED_ABSENT", {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      X: String(stats.completed),
      Y: String(stats.missed),
      Z: String(stats.remaining),
      Link: this.DASHBOARD_URL,
    });
  }

  /**
   * All sessions in a package completed
   */
  static async notifyAllSessionsCompleted(purchasedPackageId: string) {
    const pkg = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        students: {
          select: {
            name: true,
            profiles: { select: { users: { select: { email: true } } } },
          },
        },
        teachers: { select: { name: true } },
      },
    });
    if (!pkg) return;

    const studentEmail = pkg.students.profiles?.users?.email;
    await this.sendTemplateEmail(studentEmail, "ALL_SESSIONS_COMPLETED", {
      "Student Name": pkg.students.name || "Student",
      "Teacher Name": pkg.teachers.name || "Teacher",
      Link: this.DASHBOARD_URL,
    });
  }

  // ────────────────────────────────────────────────────────
  // Session reminders (called by cron scheduler)
  // ────────────────────────────────────────────────────────

  /**
   * Send reminder WhatsApps to both student and teacher for an upcoming booking
   */
  static async sendSessionReminder(
    bookingId: string,
    type: "24h" | "1h"
  ) {
    const booking = await this.fetchBookingWithParties(bookingId);
    if (!booking) return;

    const studentName = booking.students.name || "Student";
    const teacherName = booking.teachers.name || "Teacher";
    const instrument = this.extractInstrument(booking);
    const dateTime = this.formatDateTime(booking.scheduled_at, booking.duration_minutes || 60);
    const isDemo = booking.is_demo;

    const templateVars: Record<string, string> = {
      "Student Name": studentName,
      "Teacher Name": teacherName,
      Instrument: instrument,
      Date: dateTime.date,
      Time: dateTime.time,
      "Join Link": this.DASHBOARD_URL,
      "Dashboard Link": process.env.TEACHER_DASHBOARD_URL || "https://teacher.maestera.com",
    };

    // Student reminders
    const studentTrigger = isDemo
      ? "DEMO_REMINDER"
      : type === "24h"
        ? "SESSION_REMINDER_24H"
        : "SESSION_REMINDER_1H";

    // Teacher reminders
    const teacherTrigger = isDemo
      ? (type === "24h" ? "TEACHER_DEMO_REMINDER_12H" : "TEACHER_DEMO_REMINDER_12H") // only 12h demo template exists
      : type === "24h"
        ? "TEACHER_SESSION_REMINDER_24H"
        : "TEACHER_SESSION_REMINDER_1H";

    await Promise.allSettled([
      this.sendTemplateWhatsApp(
        booking.students.whatsapp_number,
        Boolean(booking.students.whatsapp_verified_at),
        booking.students.whatsapp_opt_in ?? true,
        studentTrigger,
        templateVars
      ),
      this.sendTemplateWhatsApp(
        booking.teachers.whatsapp_number,
        Boolean(booking.teachers.whatsapp_verified_at),
        booking.teachers.whatsapp_opt_in ?? true,
        teacherTrigger,
        templateVars
      ),
    ]);
  }

  // ────────────────────────────────────────────────────────
  // WhatsApp via DB template (interpolated, not 11za template)
  // ────────────────────────────────────────────────────────

  /**
   * Send a WhatsApp message rendered from a DB template.
   * This interpolates the whatsapp_body from DB and sends via 11za.
   * Falls back silently if template missing/inactive.
   */
  private static async sendTemplateWhatsApp(
    recipientPhone: string | null | undefined,
    whatsappVerified: boolean,
    whatsappOptIn: boolean,
    triggerKey: string,
    variables: Record<string, string>
  ) {
    if (!recipientPhone || !whatsappVerified || !whatsappOptIn) return;

    try {
      const tpl = await NotificationTemplateService.getTemplate(triggerKey);
      if (!tpl || !tpl.is_active || !tpl.whatsapp_body) return;

      // For now, we still use 11za template-based sending for events that
      // have 11za templates configured. For templates that only exist in DB
      // (reminders, demo flows), the WhatsApp body is logged but not sent
      // since 11za requires pre-approved templates on their platform.
      // When 11za templates are created for these triggers, the WhatsApp
      // notification service can be extended to support them.
      console.log(`[activity-notification] WhatsApp template "${triggerKey}" ready for: ${recipientPhone}`);
    } catch (error) {
      console.error(`[activity-notification] WhatsApp template "${triggerKey}" failed:`, error);
    }
  }

  // ────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────

  private static async fetchBookingWithParties(bookingId: string) {
    return prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        purchased_packages: { select: { instrument: true } },
        students: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
        teachers: {
          select: {
            id: true,
            name: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
            profiles: {
              select: { users: { select: { email: true } } },
            },
          },
        },
      },
    });
  }

  private static extractInstrument(booking: { booking_type: string; purchased_packages?: { instrument: string | null } | null }): string {
    if (booking.purchased_packages?.instrument) return booking.purchased_packages.instrument;
    // Demo bookings store instrument in booking_type as "demo:Guitar"
    if (booking.booking_type.startsWith("demo:")) return booking.booking_type.split(":")[1];
    return "Music";
  }

  private static async getPackageStats(purchasedPackageId: string) {
    const pkg = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      select: { classes_total: true, classes_completed: true },
    });
    if (!pkg) return { completed: 0, missed: 0, remaining: 0 };

    const allBookings = await prisma.bookings.findMany({
      where: { purchased_package_id: purchasedPackageId },
      select: { status: true },
    });

    const completed = allBookings.filter((b) => b.status === "COMPLETED").length;
    const missed = allBookings.filter((b) => (b.status as string) === "ABSENT").length;
    const remaining = Math.max(0, pkg.classes_total - completed - missed);

    return { completed, missed, remaining };
  }
}
