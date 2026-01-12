export interface EmailJob {
    to: string;
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
    retries?: number;
    createdAt?: Date;
}
declare class EmailQueue {
    private queue;
    private isProcessing;
    private maxRetries;
    private failedEmails;
    add(emailData: EmailJob): Promise<void>;
    private processQueue;
    getFailedEmails(): EmailJob[];
    getQueueSize(): number;
}
export declare const emailQueue: EmailQueue;
export declare function queueEmail(emailData: EmailJob): Promise<void>;
export declare function getFailedEmails(): EmailJob[];
export declare function getEmailQueueStats(): {
    queued: number;
    failed: number;
};
export {};
//# sourceMappingURL=email-queue.service.d.ts.map