import { Resend } from 'resend'
import logger from '../utils/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailJob {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  retries?: number
  createdAt?: Date
}

// Simple in-memory queue
class EmailQueue {
  private queue: EmailJob[] = []
  private isProcessing = false
  private maxRetries = 3
  private failedEmails: EmailJob[] = []

  async add(emailData: EmailJob): Promise<void> {
    const job: EmailJob = {
      ...emailData,
      retries: 0,
      createdAt: new Date(),
    }
    this.queue.push(job)
    logger.info({ email: emailData.to }, '📤 Email queued')
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()
      if (!job) break

      try {
        logger.info({ email: job.to }, '📧 Sending email...')

        const result = await resend.emails.send({
          from: job.from || process.env.RESEND_FROM_EMAIL || 'noreply@maestera.app',
          to: job.to,
          subject: job.subject,
          html: job.html,
          replyTo: job.replyTo,
        })

        logger.info({ email: job.to, result }, '✅ Email sent successfully')
      } catch (error) {
        job.retries = (job.retries || 0) + 1

        if (job.retries < this.maxRetries) {
          logger.warn(
            { email: job.to, retries: job.retries, error },
            `⚠️ Email failed, retrying (${job.retries}/${this.maxRetries})...`
          )
          // Re-queue with delay
          setTimeout(() => this.queue.push(job), 5000 * job.retries)
        } else {
          logger.error({ email: job.to, error }, '❌ Email failed after max retries')
          this.failedEmails.push(job)
        }
      }

      // Small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    this.isProcessing = false
  }

  getFailedEmails(): EmailJob[] {
    return this.failedEmails
  }

  getQueueSize(): number {
    return this.queue.length
  }
}

export const emailQueue = new EmailQueue()

// Helper function to queue an email
export async function queueEmail(emailData: EmailJob): Promise<void> {
  await emailQueue.add(emailData)
}

// Get failed emails for monitoring/retry
export function getFailedEmails(): EmailJob[] {
  return emailQueue.getFailedEmails()
}

// Get queue stats
export function getEmailQueueStats() {
  return {
    queued: emailQueue.getQueueSize(),
    failed: emailQueue.getFailedEmails().length,
  }
}
