import { Queue, Worker } from 'bullmq'
import { Resend } from 'resend'
import logger from '../utils/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

// Redis connection for BullMQ
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

export interface EmailJob {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}

// Create email queue
export const emailQueue = new Queue<EmailJob>('emails', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
})

// Process email jobs
export const emailWorker = new Worker<EmailJob>(
  'emails',
  async (job) => {
    try {
      logger.info({ jobId: job.id, email: job.data.to }, '📧 Processing email job...')

      const result = await resend.emails.send({
        from: job.data.from || process.env.RESEND_FROM_EMAIL || 'noreply@maestera.app',
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
        replyTo: job.data.replyTo,
      })

      logger.info({ jobId: job.id, email: job.data.to, result }, '✅ Email sent successfully')
      return result
    } catch (error) {
      logger.error({ jobId: job.id, error }, '❌ Failed to send email')
      throw error
    }
  },
  {
    connection: redisConfig,
    concurrency: 5, // Process 5 emails at a time
  }
)

// Handle worker events
emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '✅ Email job completed')
})

emailWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, '❌ Email job failed')
})

// Helper function to queue an email
export async function queueEmail(emailData: EmailJob): Promise<void> {
  try {
    await emailQueue.add('send', emailData, {
      jobId: `${Date.now()}-${Math.random()}`,
    })
    logger.info({ email: emailData.to }, '📤 Email queued')
  } catch (error) {
    logger.error({ error }, '❌ Failed to queue email')
    throw error
  }
}

// Close queue on shutdown
process.on('SIGTERM', async () => {
  await emailQueue.close()
  await emailWorker.close()
})
