import { Queue, Worker } from 'bullmq';
export interface EmailJob {
    to: string;
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}
export declare const emailQueue: Queue<EmailJob, any, string, EmailJob, any, string>;
export declare const emailWorker: Worker<EmailJob, any, string>;
export declare function queueEmail(emailData: EmailJob): Promise<void>;
//# sourceMappingURL=email.service.d.ts.map