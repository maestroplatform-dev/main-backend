/**
 * Generate a secure random password
 * @param length - Length of password (default: 16)
 * @returns Generated password
 */
export declare function generateSecurePassword(length?: number): string;
/**
 * Send teacher credentials email with HTML template
 * Primary: Resend
 * Fallback: Queue for later retry
 * @param email - Teacher's email
 * @param password - Generated password
 * @param teacherName - Teacher's name
 */
export declare function sendTeacherCredentialsEmail(email: string, password: string, teacherName?: string): Promise<void>;
/**
 * Process queued emails - retry sending pending emails
 * Call this periodically (e.g., via cron job or scheduler)
 */
export declare function processEmailQueue(): Promise<{
    sent: number;
    failed: number;
}>;
/**
 * Send custom transactional email
 * Primary: Supabase
 * Fallback: Resend
 * @param email - Recipient email
 * @param subject - Email subject
 * @param htmlContent - HTML content of the email
 */
export declare function sendTransactionalEmail(email: string, subject: string, htmlContent: string): Promise<void>;
//# sourceMappingURL=email.d.ts.map