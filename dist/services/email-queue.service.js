"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
exports.queueEmail = queueEmail;
exports.getFailedEmails = getFailedEmails;
exports.getEmailQueueStats = getEmailQueueStats;
const resend_1 = require("resend");
const logger_1 = __importDefault(require("../utils/logger"));
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
// Simple in-memory queue
class EmailQueue {
    queue = [];
    isProcessing = false;
    maxRetries = 3;
    failedEmails = [];
    async add(emailData) {
        const job = {
            ...emailData,
            retries: 0,
            createdAt: new Date(),
        };
        this.queue.push(job);
        logger_1.default.info({ email: emailData.to }, '📤 Email queued');
        this.processQueue();
    }
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                break;
            try {
                logger_1.default.info({ email: job.to }, '📧 Sending email...');
                const result = await resend.emails.send({
                    from: job.from || process.env.RESEND_FROM_EMAIL || 'noreply@maestera.app',
                    to: job.to,
                    subject: job.subject,
                    html: job.html,
                    replyTo: job.replyTo,
                });
                logger_1.default.info({ email: job.to, result }, '✅ Email sent successfully');
            }
            catch (error) {
                job.retries = (job.retries || 0) + 1;
                if (job.retries < this.maxRetries) {
                    logger_1.default.warn({ email: job.to, retries: job.retries, error }, `⚠️ Email failed, retrying (${job.retries}/${this.maxRetries})...`);
                    // Re-queue with delay
                    setTimeout(() => this.queue.push(job), 5000 * job.retries);
                }
                else {
                    logger_1.default.error({ email: job.to, error }, '❌ Email failed after max retries');
                    this.failedEmails.push(job);
                }
            }
            // Small delay between emails to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        this.isProcessing = false;
    }
    getFailedEmails() {
        return this.failedEmails;
    }
    getQueueSize() {
        return this.queue.length;
    }
}
exports.emailQueue = new EmailQueue();
// Helper function to queue an email
async function queueEmail(emailData) {
    await exports.emailQueue.add(emailData);
}
// Get failed emails for monitoring/retry
function getFailedEmails() {
    return exports.emailQueue.getFailedEmails();
}
// Get queue stats
function getEmailQueueStats() {
    return {
        queued: exports.emailQueue.getQueueSize(),
        failed: exports.emailQueue.getFailedEmails().length,
    };
}
//# sourceMappingURL=email-queue.service.js.map