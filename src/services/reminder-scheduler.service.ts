import cron, { ScheduledTask } from 'node-cron'
import prisma from '../config/database'
import { ActivityNotificationService } from './activity-notification.service'

/**
 * Reminder scheduler — sends WhatsApp reminders to both student and teacher
 * before upcoming sessions.
 *
 * Runs every 15 minutes and sends:
 *  - 24-hour reminders  (23h45m – 24h15m window)
 *  - 1-hour reminders   (45m – 1h15m window)
 *  - 12-hour demo reminders (11h45m – 12h15m window)
 *
 * Idempotency: a JSON metadata field `reminder_sent` on each booking tracks
 * which reminders have already been dispatched, so restarting the server or
 * overlapping windows never send duplicates.
 */
export class ReminderSchedulerService {
  private static task: ScheduledTask | null = null

  /** Start the cron job. Safe to call multiple times. */
  static start() {
    if (this.task) return

    // Every 15 minutes
    this.task = cron.schedule('*/15 * * * *', () => {
      void this.tick().catch((err) => {
        console.error('[reminder-scheduler] tick error:', err)
      })
    })

    console.log('[reminder-scheduler] Cron started — running every 15 minutes')
  }

  /** Stop the cron job (useful for graceful shutdown). */
  static stop() {
    if (this.task) {
      this.task.stop()
      this.task = null
      console.log('[reminder-scheduler] Cron stopped')
    }
  }

  /** Single tick — find upcoming bookings and send reminders. */
  private static async tick() {
    const now = new Date()

    await Promise.allSettled([
      this.sendReminders(now, 24 * 60, '24h'),
      this.sendReminders(now, 60, '1h'),
      this.sendDemoReminders(now, 12 * 60, '12h'),
    ])
  }

  /**
   * Find scheduled bookings whose `scheduled_at` falls within
   * `[now + offsetMinutes - 15min, now + offsetMinutes + 15min)`
   * and send the corresponding reminder type.
   */
  private static async sendReminders(
    now: Date,
    offsetMinutes: number,
    reminderKey: '24h' | '1h'
  ) {
    const windowStart = new Date(now.getTime() + (offsetMinutes - 15) * 60_000)
    const windowEnd = new Date(now.getTime() + (offsetMinutes + 15) * 60_000)

    const bookings = await prisma.bookings.findMany({
      where: {
        status: 'SCHEDULED',
        scheduled_at: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true, metadata: true },
    })

    for (const booking of bookings) {
      const meta = (booking.metadata as Record<string, unknown>) || {}
      const sentReminders = (meta.reminder_sent as string[]) || []

      if (sentReminders.includes(reminderKey)) continue

      try {
        await ActivityNotificationService.sendSessionReminder(booking.id, reminderKey)

        // Mark reminder as sent
        await prisma.bookings.update({
          where: { id: booking.id },
          data: {
            metadata: { ...meta, reminder_sent: [...sentReminders, reminderKey] },
          } as any,
        })
      } catch (error) {
        console.error(`[reminder-scheduler] Failed to send ${reminderKey} reminder for booking ${booking.id}:`, error)
      }
    }

    if (bookings.length > 0) {
      console.log(`[reminder-scheduler] Processed ${bookings.length} bookings for ${reminderKey} reminders`)
    }
  }

  /**
   * 12-hour demo session reminders (teacher.txt #12)
   */
  private static async sendDemoReminders(
    now: Date,
    offsetMinutes: number,
    reminderKey: string
  ) {
    const windowStart = new Date(now.getTime() + (offsetMinutes - 15) * 60_000)
    const windowEnd = new Date(now.getTime() + (offsetMinutes + 15) * 60_000)

    const bookings = await prisma.bookings.findMany({
      where: {
        status: 'SCHEDULED',
        is_demo: true,
        scheduled_at: { gte: windowStart, lt: windowEnd },
      },
      select: { id: true, metadata: true },
    })

    for (const booking of bookings) {
      const meta = (booking.metadata as Record<string, unknown>) || {}
      const sentReminders = (meta.reminder_sent as string[]) || []

      if (sentReminders.includes(reminderKey)) continue

      try {
        // Use the demo reminder for student side, teacher demo 12h for teacher
        await ActivityNotificationService.sendSessionReminder(booking.id, '24h')

        await prisma.bookings.update({
          where: { id: booking.id },
          data: {
            metadata: { ...meta, reminder_sent: [...sentReminders, reminderKey] },
          } as any,
        })
      } catch (error) {
        console.error(`[reminder-scheduler] Failed to send ${reminderKey} demo reminder for booking ${booking.id}:`, error)
      }
    }
  }
}
