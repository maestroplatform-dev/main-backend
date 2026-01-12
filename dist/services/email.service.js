"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = exports.emailQueue = void 0;
exports.queueEmail = queueEmail;
const bullmq_1 = require("bullmq");
const resend_1 = require("resend");
const logger_1 = __importDefault(require("../utils/logger"));
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// Redis connection for BullMQ
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};
// Create email queue
exports.emailQueue = new bullmq_1.Queue('emails', {
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
});
// Process email jobs
exports.emailWorker = new bullmq_1.Worker('emails', async (job) => {
    try {
        logger_1.default.info({ jobId: job.id, email: job.data.to }, '📧 Processing email job...');
        const result = await resend.emails.send({
            from: job.data.from || process.env.RESEND_FROM_EMAIL || 'noreply@maestera.app',
            to: job.data.to,
            subject: job.data.subject,
            html: job.data.html,
            replyTo: job.data.replyTo,
        });
        logger_1.default.info({ jobId: job.id, email: job.data.to, result }, '✅ Email sent successfully');
        return result;
    }
    catch (error) {
        logger_1.default.error({ jobId: job.id, error }, '❌ Failed to send email');
        throw error;
    }
}, {
    connection: redisConfig,
    concurrency: 5, // Process 5 emails at a time
});
// Handle worker events
exports.emailWorker.on('completed', (job) => {
    logger_1.default.info({ jobId: job.id }, '✅ Email job completed');
});
exports.emailWorker.on('failed', (job, err) => {
    logger_1.default.error({ jobId: job?.id, error: err }, '❌ Email job failed');
});
// Helper function to queue an email
async function queueEmail(emailData) {
    try {
        await exports.emailQueue.add('send', emailData, {
            jobId: `${Date.now()}-${Math.random()}`,
        });
        logger_1.default.info({ email: emailData.to }, '📤 Email queued');
    }
    catch (error) {
        logger_1.default.error({ error }, '❌ Failed to queue email');
        throw error;
    }
}
// Close queue on shutdown
process.on('SIGTERM', async () => {
    await exports.emailQueue.close();
    await exports.emailWorker.close();
});
//# sourceMappingURL=email.service.js.map