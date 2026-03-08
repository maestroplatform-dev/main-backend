import prisma from '../config/database'

export type NotificationTemplatePayload = {
  trigger_key: string
  name: string
  audience: 'student' | 'teacher' | 'both'
  channels: Array<'email' | 'whatsapp'>
  email_subject?: string | null
  email_body?: string | null
  whatsapp_body?: string | null
  variables?: string[]
  is_active?: boolean
}

const DEFAULT_TEMPLATES: NotificationTemplatePayload[] = [
  {
    trigger_key: 'STUDENT_SIGNUP_WELCOME',
    name: 'Student signup welcome',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Welcome to Maestera',
    email_body:
      'Hi {{Student Name}},\nWelcome to Maestera.\nYou’ve just stepped into a space where musicians grow through guidance, practice, and the right teachers.\nHere’s what you can do next:\n• Explore teachers across instruments\n• Choose the teacher that fits your goals\n• Schedule lessons at your convenience\n• Begin your learning journey\nIf you ever need help selecting a teacher or planning your lessons, your Learning Manager is here for you.\nStart exploring teachers here:\n{{Browse Teachers Link}}\nLooking forward to being part of your musical journey.\nWarmly,\nTeam Maestera',
    variables: ['Student Name', 'Browse Teachers Link'],
  },
  {
    trigger_key: 'STUDENT_PREFERENCES_RECEIVED',
    name: 'Student preferences received',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Your Maestera lessons are confirmed',
    email_body:
      'Hi {{Student Name}},\nThank you for sharing your learning preferences with us. Your details are as follows:\nInstrument: {{Instrument}}\nMode: {{Mode}}\nFee Range: {{Fee Range}}\nLevel: {{Level}}\nLearning Goals: {{Learning Goals}}\nYour Learning Manager has received your details and is now reviewing them carefully to find music teachers who best align with what you\'re looking for. While we aim to match your preferences as closely as possible, availability may sometimes vary.\nWhat happens next\n• Our team will shortlist suitable teachers for you\n• You will receive up to three teacher recommendations\n• You can review their profiles and schedule a demo or lesson\nYou will hear from us shortly with your teacher matches.\nIf you have any questions in the meantime, please feel free to reach out to us.\nRegards,\nTeam Maestera',
    variables: ['Student Name', 'Instrument', 'Mode', 'Fee Range', 'Level', 'Learning Goals'],
  },
  {
    trigger_key: 'DEMO_SCHEDULED_AFTER_TEACHER_APPROVAL',
    name: 'Demo scheduled after approval',
    audience: 'student',
    channels: ['email', 'whatsapp'],
    email_subject: 'Maestera - {{Instrument}} Demo Session',
    email_body:
      'Hi {{Student Name}} 🎶\nYour {{Instrument}} demo session with {{Teacher Name}} has been scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nOur teachers reserve time specially for these sessions, so we request you to kindly avoid cancelling once scheduled or inform us in advance if you need to reschedule.\nTeam Maestera',
    whatsapp_body:
      'Hi {{Student Name}} 🎶\nYour {{Instrument}} demo session with {{Teacher Name}} has been scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nOur teachers reserve time specially for these sessions, so we request you to kindly avoid cancelling once scheduled or inform us in advance if you need to reschedule.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'DEMO_RESCHEDULED_AFTER_TEACHER_APPROVAL',
    name: 'Demo rescheduled after approval',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Hi {{Student Name}} 🎶\nYour {{Instrument}} demo session with {{Teacher Name}} has been re-scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nOur teachers reserve time specially for these sessions, so we request you to kindly avoid cancelling once scheduled or inform us in advance if you need to reschedule.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'DEMO_CANCELLED',
    name: 'Demo cancelled',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Hi {{Student Name}},\nYour {{Instrument}} demo session with {{Teacher Name}} scheduled for {{Date}} at {{Time}} has been cancelled.\nWe’d still love to help you get started.\nYou can:\n• Propose a new time with the same teacher\n• Explore other teachers available at a different slot\n• Reach out to us and we’ll help you find a suitable teacher\nWe’re happy to assist you in getting your demo scheduled at the earliest.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'DEMO_NEW_PROPOSED_TIME',
    name: 'Demo new proposed time',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Hi {{Student Name}}\n{{Teacher Name}} has proposed a new time for your {{Instrument}} demo session.\nPlease review and confirm here:\n{{Link}}\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Link'],
  },
  {
    trigger_key: 'DEMO_POST_SESSION',
    name: 'Post demo follow-up',
    audience: 'student',
    channels: ['email', 'whatsapp'],
    email_subject: 'Maestera - {{Instrument}} Demo Session',
    email_body:
      'Hi {{Student Name}} 🎶\nWe hope you enjoyed your {{Instrument}} demo session with {{Teacher Name}}.\nYou can now continue learning by scheduling your lessons. Simply make the payment and schedule your upcoming sessions here:\n{{Link}}\nTeam Maestera',
    whatsapp_body:
      'Hi {{Student Name}} 🎶\nWe hope you enjoyed your {{Instrument}} demo session with {{Teacher Name}}.\nYou can now continue learning by scheduling your lessons. Simply make the payment and schedule your upcoming sessions here:\n{{Link}}\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Link'],
  },
  {
    trigger_key: 'DEMO_REMINDER',
    name: 'Demo reminder',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Hi {{Student Name}} 🎶\nJust a reminder about your scheduled {{Instrument}} demo session with {{Teacher Name}}.\nDate: {{Date}}\nTime: {{Time}}\nOur teachers reserve time specially for these sessions, so we request you to kindly avoid cancelling once scheduled or inform us in advance if you need to reschedule.\nLooking forward to having you in the session.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'PAYMENT_SUCCESS',
    name: 'Payment success',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Your Maestera lessons are confirmed',
    email_body:
      'Hi {{Student Name}},\nYour learning sessions with {{Teacher Name}} has been successfully booked.\nDetails\nInstrument: {{Instrument}}\nTeacher: {{Teacher Name}}\nMode: {{Mode}}\nLevel: {{Level}}\nDuration of lesson: {{Duration of lesson}}\nFee per lesson: {{Fee per lesson}}\nNumber of Lessons: {{Number of Lessons}}\nPurchase Date: {{Date}}\nAmount Paid: {{Amount Paid}}\nYour invoice is attached to this email.\nNext step:\nSchedule your lessons at your convenience.\nSchedule here:\n{{Schedule Link}}\nIf you need any assistance with scheduling or planning your lessons, your Learning Manager is here for you.\n\nHappy learning,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Mode', 'Level', 'Duration of lesson', 'Fee per lesson', 'Number of Lessons', 'Date', 'Amount Paid', 'Schedule Link'],
  },
  {
    trigger_key: 'SESSION_APPROVED_BY_TEACHER',
    name: 'Session approved by teacher',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Maestera - {{Instrument}} lessons scheduled',
    email_body:
      'Hi {{Student Name}},\nYour {{Instrument}} session has been successfully scheduled & accepted by {{Teacher Name}}\n\nDate: {{Date}}\nTime: {{Time}}\nMode: {{Mode}}\nIf you need to reschedule/cancel, you can do so from your dashboard.\nView your schedule here:\n{{Dashboard Link}}\nWe look forward to your upcoming session.\nHappy learning,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Mode', 'Dashboard Link'],
  },
  {
    trigger_key: 'SESSION_RESCHEDULE_APPROVED_BY_TEACHER',
    name: 'Session reschedule approved by teacher',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Maestera - {{Instrument}} lessons rescheduled',
    email_body:
      'Hi {{Student Name}},\nYour {{Instrument}} session has been successfully re-scheduled & accepted by {{Teacher Name}}\n\nDate: {{Date}}\nTime: {{Time}}\nMode: {{Mode}}\nIf you need to reschedule/cancel, you can do so from your dashboard.\nView your schedule here:\n{{Dashboard Link}}\nWe look forward to your upcoming session.\nHappy learning,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Mode', 'Dashboard Link'],
  },
  {
    trigger_key: 'SESSION_CANCELLED_BY_STUDENT',
    name: 'Session cancelled by student',
    audience: 'student',
    channels: ['email'],
    email_body:
      'Hi {{Student Name}},\nThis is to confirm that your {{Instrument}} session with {{Teacher Name}}, scheduled for {{Date}} at {{Time}}, has been cancelled as requested.\nIf you would like to continue your lessons, you may schedule another session at a time convenient for you, subject to teacher’s availability, through the dashboard itself.\nSchedule your next session here: {{Link}}\nIf you need any assistance with rescheduling or planning your upcoming lessons, please feel free to reach out to us.\nRegards,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'SESSION_CANCELLED_BY_TEACHER',
    name: 'Session cancelled by teacher',
    audience: 'student',
    channels: ['email', 'whatsapp'],
    email_subject: 'Maestera - {{Instrument}} Session Cancelled',
    email_body:
      'Hi {{Student Name}},\nYour {{Instrument}} session with {{Teacher Name}} scheduled for {{Date}} at {{Time}} has been cancelled by the teacher.\nYou may propose a new time to reschedule, or let us know if you would like our team to assist in coordinating another slot.\nTeam Maestera',
    whatsapp_body:
      'Hi {{Student Name}},\nYour {{Instrument}} session with {{Teacher Name}} scheduled for {{Date}} at {{Time}} has been cancelled by the teacher.\nYou may propose a new time to reschedule, or let us know if you would like our team to assist in coordinating another slot.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'SESSION_PROPOSED_BY_TEACHER',
    name: 'Session proposed by teacher',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Hi {{Student Name}} 🎶\n{{Teacher Name}} has proposed the following time & date for your {{Instrument}} session.\nDate: {{Date}}\nTime: {{Time}}\nPlease review the details and confirm from your dashboard.\n{{Link}}\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'SESSION_REMINDER_24H',
    name: 'Session reminder 24 hours',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Reminder 🎶\nYou have a {{Instrument}} lesson with {{Teacher Name}} tomorrow.\nDate: {{Date}}\nTime: {{Time}}\nPlease be ready a few minutes before the session.\nHappy Learning,\nTeam Maestera',
    variables: ['Teacher Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'SESSION_REMINDER_1H',
    name: 'Session reminder 1 hour',
    audience: 'student',
    channels: ['whatsapp'],
    whatsapp_body:
      'Reminder 🎶\n\nYour {{Instrument}} lesson starts in 1 hour.\nTeacher: {{Teacher Name}}\nTime: {{Time}}\nJoin from your dashboard:\n{{Join Link}}',
    variables: ['Teacher Name', 'Instrument', 'Time', 'Join Link'],
  },
  {
    trigger_key: 'ATTENDANCE_MARKED_PRESENT',
    name: 'Attendance marked present',
    audience: 'student',
    channels: ['email'],
    email_subject: 'Maestera - {{Instrument}} Lesson completed',
    email_body:
      'Hi {{Student Name}},\nYour lesson {{Instrument}} with {{Teacher Name}} has been completed.\nProgress Update\nLessons Completed: {{X}}\nLessons Missed: {{Y}}\nLessons Remaining: {{Z}}\nYou can schedule your next session, if not already scheduled, whenever you\'re ready (subject to teacher’s availability)\nSchedule next lesson:\n{{Schedule Link}}\nConsistent practice is the key to musical progress.\nSee you in your next lesson.\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'X', 'Y', 'Z', 'Schedule Link'],
  },
  {
    trigger_key: 'ATTENDANCE_MARKED_ABSENT',
    name: 'Attendance marked absent',
    audience: 'student',
    channels: ['email'],
    email_body:
      'Hi {{Student Name}},\nYour {{Instrument}} session with {{Teacher Name}}, scheduled for {{Date}} at {{Time}}, has been marked as absent.\nProgress Update\nLessons Completed: {{X}}\nLessons Missed: {{Y}}\nLessons Remaining: {{Z}}\nIf this was due to any issue or if you would like assistance in scheduling your upcoming sessions, please feel free to reach out to us.\nYou can also review and manage your upcoming lessons here:\n{{Link}}\nWe look forward to continuing your musical journey.\nHappy Learning,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Instrument', 'Date', 'Time', 'X', 'Y', 'Z', 'Link'],
  },
  {
    trigger_key: 'ALL_SESSIONS_COMPLETED',
    name: 'All sessions completed',
    audience: 'student',
    channels: ['email'],
    email_body:
      'Hi {{Student Name}},\nWe hope you have been enjoying your learning journey on Maestera.\nThis is to inform you that you have now completed all your scheduled sessions with {{Teacher Name}}.\nIf you would like to continue learning, you can easily schedule your next set of lessons by making the payment and scheduling your upcoming sessions.\nContinue your lessons here:\n{{Link}}\nConsistent practice and regular sessions make a big difference in musical progress, and we would be happy to support you as you move forward in your learning journey.\nIf you need any assistance, please feel free to reach out to us.\nRegards,\nTeam Maestera',
    variables: ['Student Name', 'Teacher Name', 'Link'],
  },
  {
    trigger_key: 'TEACHER_SIGNUP_WELCOME',
    name: 'Teacher signup welcome',
    audience: 'teacher',
    channels: ['email'],
    email_subject: 'Welcome to Maestera',
    email_body:
      'Hi {{Teacher Name}},\nWelcome to Maestera.\nYou are now part of a growing community of musicians and educators helping students learn with the right guidance and structure.\nThrough Maestera, you can:\n• Connect with students looking to learn your instrument\n• Set your availability and manage your schedule\n• Conduct lessons and track sessions\n• Build long-term learning relationships with students\nOnce your profile is approved and live, students will be able to book lessons with you.\nAccess your dashboard here:\n{{Teacher Dashboard Link}}\nWe’re excited to have you with us.\nRegards,\nTeam Maestera',
    variables: ['Teacher Name', 'Teacher Dashboard Link'],
  },
  {
    trigger_key: 'LESSON_SCHEDULED_FOR_TEACHER',
    name: 'Lesson scheduled for teacher',
    audience: 'teacher',
    channels: ['email'],
    email_subject: 'Maestera - New Sessions',
    email_body: 'Hi {{Teacher Name}},\nA student has purchased lessons with you.\nStudent: {{Student Name}}\nInstrument: {{Instrument}}\nNumber of Lessons: {{Number}}\nMode: {{Mode}}\nThe student will now begin scheduling sessions based on your availability. Alternatively, you can also initiate scheduling the sessions.\nYou can manage the schedule from your dashboard:\n{{Teacher Dashboard Link}}\nWe\'re excited to see this learning journey begin.\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Number', 'Mode', 'Teacher Dashboard Link'],
  },
  // ── Teacher-side templates from teacher.txt ──
  {
    trigger_key: 'TEACHER_DEMO_REQUESTED',
    name: 'Student requests demo with teacher',
    audience: 'teacher',
    channels: ['email', 'whatsapp'],
    email_subject: 'New Demo Request – {{Instrument}}',
    email_body: 'Hi {{Teacher Name}} 🎶\nYou have received a demo session request from a student.\nStudent: {{Student Name}}\nInstrument: {{Instrument}}\nDate: {{Date}}\nTime: {{Time}}\nPlease review the request and approve a suitable time.\nConfirm here:\n {{Dashboard Link}}\nOnce approved, the student will receive the session details.\nTeam Maestera',
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\nYou have received a demo session request from a student.\nStudent: {{Student Name}}\nInstrument: {{Instrument}}\nDate: {{Date}}\nTime: {{Time}}\nPlease review the request and approve a suitable time.\nConfirm here:\n {{Dashboard Link}}\nOnce approved, the student will receive the session details.\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Dashboard Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_APPROVED',
    name: 'Teacher approves demo session',
    audience: 'teacher',
    channels: ['email'],
    email_subject: 'Demo Session Confirmed – {{Student Name}}',
    email_body: 'Hi {{Teacher Name}},\nYour demo session with the following student has been scheduled.\nStudent: {{Student Name}}\nInstrument: {{Instrument}}\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details in your dashboard here:\n{{Dashboard Link}}\nWe wish you a great session.\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Dashboard Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_RESCHEDULED_BY_STUDENT',
    name: 'Student reschedules demo (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\n{{Student Name}} has requested to reschedule the {{Instrument}} demo session.\nPlease review and approve the proposed time here:\n{{Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_CANCELLED_BY_STUDENT',
    name: 'Student cancels demo (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}},\nThe {{Instrument}} demo session with {{Student Name}} scheduled for {{Date}} at {{Time}} has been cancelled by the student.\nThe slot is now available in your schedule.\nView your dashboard here:\n{{Dashboard Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Dashboard Link'],
  },
  {
    trigger_key: 'TEACHER_SESSION_PROPOSED_BY_STUDENT',
    name: 'Student proposes lesson time (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\n{{Student Name}} has proposed a time for your {{Instrument}} lesson.\nDate: {{Date}}\nTime: {{Time}}\nPlease review and confirm the session here:\n{{Dashboard Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Dashboard Link'],
  },
  {
    trigger_key: 'TEACHER_SESSION_RESCHEDULED_BY_STUDENT',
    name: 'Student reschedules session (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\n{{Student Name}} has proposed the following time & date for your {{Instrument}} session.\nDate: {{Date}}\nTime: {{Time}}\nPlease review the details and confirm from your dashboard.\n{{Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'TEACHER_SESSION_REMINDER_24H',
    name: 'Teacher session reminder 24 hours',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Reminder 🎶\nYou have a {{Instrument}} lesson with {{Student Name}} tomorrow.\nDate: {{Date}}\nTime: {{Time}}\nTeam Maestera',
    variables: ['Student Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'TEACHER_SESSION_REMINDER_1H',
    name: 'Teacher session reminder 1 hour',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Reminder 🎶\nYour {{Instrument}} lesson with {{Student Name}} begins in 1 hour.\nTime: {{Time}}\nAccess session details here:\n{{Dashboard Link}}\nTeam Maestera',
    variables: ['Student Name', 'Instrument', 'Time', 'Dashboard Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_RESCHEDULED_CONFIRMED',
    name: 'Demo rescheduled and student approved (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\n{{Instrument}} demo session with {{Student Name}} has been rescheduled to Date: {{Date}}\nTime: {{Time}}\n{{Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_REMINDER_12H',
    name: 'Teacher demo reminder 12 hours',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Reminder 🎶\nYou have a {{Instrument}} demo lesson with {{Student Name}} on.\nDate: {{Date}}\nTime: {{Time}}',
    variables: ['Student Name', 'Instrument', 'Date', 'Time'],
  },
  {
    trigger_key: 'TEACHER_DEMO_SCHEDULED_CONFIRMED',
    name: 'Demo scheduled (teacher-initiated, after student approval)',
    audience: 'teacher',
    channels: ['email', 'whatsapp'],
    email_subject: 'Maestera - {{Instrument}} Demo Session',
    email_body: 'Hi {{Teacher Name}} 🎶\nYour {{Instrument}} demo session with {{Student Name}} has been scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nTeam Maestera',
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\nYour {{Instrument}} demo session with {{Student Name}} has been scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'TEACHER_DEMO_RESCHEDULED_CONFIRMED_BY_STUDENT',
    name: 'Demo rescheduled (teacher-initiated, after student approval)',
    audience: 'teacher',
    channels: ['email', 'whatsapp'],
    email_subject: 'Maestera - {{Instrument}} Demo Session Rescheduled',
    email_body: 'Hi {{Teacher Name}} 🎶\nYour {{Instrument}} demo session with {{Student Name}} has been re-scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nTeam Maestera',
    whatsapp_body: 'Hi {{Teacher Name}} 🎶\nYour {{Instrument}} demo session with {{Student Name}} has been re-scheduled as follows:\nDate: {{Date}}\nTime: {{Time}}\nYou can view the session details & join the link through the dashboard here:\n{{Link}}\nTeam Maestera',
    variables: ['Teacher Name', 'Student Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
  {
    trigger_key: 'TEACHER_SESSION_CANCELLED_BY_STUDENT',
    name: 'Session cancelled by student (teacher notification)',
    audience: 'teacher',
    channels: ['whatsapp'],
    whatsapp_body: 'Hi {{Teacher Name}},\nYour {{Instrument}} session scheduled for {{Date}} at {{Time}} has been cancelled.\nYou may reschedule the session from your dashboard here:\n{{Link}}\nTeam Maestera 🎶',
    variables: ['Teacher Name', 'Instrument', 'Date', 'Time', 'Link'],
  },
]

export class NotificationTemplateService {
  static async listTemplates() {
    return prisma.notification_templates.findMany({
      orderBy: [{ audience: 'asc' }, { trigger_key: 'asc' }],
    })
  }

  static async getTemplate(triggerKey: string) {
    return prisma.notification_templates.findUnique({
      where: { trigger_key: triggerKey },
    })
  }

  static async upsertTemplate(payload: NotificationTemplatePayload) {
    return prisma.notification_templates.upsert({
      where: { trigger_key: payload.trigger_key },
      update: {
        name: payload.name,
        audience: payload.audience,
        channels: payload.channels,
        email_subject: payload.email_subject ?? null,
        email_body: payload.email_body ?? null,
        whatsapp_body: payload.whatsapp_body ?? null,
        variables: payload.variables || [],
        is_active: payload.is_active ?? true,
        updated_at: new Date(),
      },
      create: {
        trigger_key: payload.trigger_key,
        name: payload.name,
        audience: payload.audience,
        channels: payload.channels,
        email_subject: payload.email_subject ?? null,
        email_body: payload.email_body ?? null,
        whatsapp_body: payload.whatsapp_body ?? null,
        variables: payload.variables || [],
        is_active: payload.is_active ?? true,
      },
    })
  }

  static async setActive(triggerKey: string, isActive: boolean) {
    return prisma.notification_templates.update({
      where: { trigger_key: triggerKey },
      data: {
        is_active: isActive,
        updated_at: new Date(),
      },
    })
  }

  static async seedDefaults(overwrite = false) {
    let created = 0
    let updated = 0

    for (const template of DEFAULT_TEMPLATES) {
      const existing = await prisma.notification_templates.findUnique({
        where: { trigger_key: template.trigger_key },
        select: { id: true },
      })

      if (existing && !overwrite) {
        continue
      }

      if (existing && overwrite) {
        await prisma.notification_templates.update({
          where: { trigger_key: template.trigger_key },
          data: {
            name: template.name,
            audience: template.audience,
            channels: template.channels,
            email_subject: template.email_subject ?? null,
            email_body: template.email_body ?? null,
            whatsapp_body: template.whatsapp_body ?? null,
            variables: template.variables || [],
            is_active: template.is_active ?? true,
            updated_at: new Date(),
          },
        })
        updated += 1
      } else {
        await prisma.notification_templates.create({
          data: {
            trigger_key: template.trigger_key,
            name: template.name,
            audience: template.audience,
            channels: template.channels,
            email_subject: template.email_subject ?? null,
            email_body: template.email_body ?? null,
            whatsapp_body: template.whatsapp_body ?? null,
            variables: template.variables || [],
            is_active: template.is_active ?? true,
          },
        })
        created += 1
      }
    }

    const total = await prisma.notification_templates.count()
    return { created, updated, total }
  }
}
