import { supabaseAdmin } from '../config/supabase'
import { AppError } from '../types'
import { Resend } from 'resend'
import prisma from '../config/database'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Generate a secure random password
 * @param length - Length of password (default: 16)
 * @returns Generated password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'

  const allChars = uppercase + lowercase + numbers + symbols
  let password = ''

  // Ensure at least one char from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

/**
 * Send teacher credentials email with HTML template
 * Primary: Resend
 * Fallback: Queue for later retry
 * @param email - Teacher's email
 * @param password - Generated password
 * @param teacherName - Teacher's name
 */
export async function sendTeacherCredentialsEmail(
  email: string,
  password: string,
  teacherName: string = 'Teacher'
): Promise<void> {
  const htmlContent = generateCredentialsEmailHTML(email, password, teacherName)
  const subject = 'Welcome to Maestera - Your Teacher Account Credentials'

  // Try Resend as primary email service
  if (resend) {
    try {
      await sendViaResend(email, subject, htmlContent)
      console.log(`✅ Credentials email sent via Resend to: ${email}`)
      return
    } catch (error) {
      console.warn(`⚠️  Resend email failed:`, error)
      // Queue the email for retry
      await queueEmail(email, subject, htmlContent, { teacherName, password })
      console.log(`📬 Email queued for retry: ${email}`)
      return
    }
  }

  // No email service configured - queue for when it becomes available
  await queueEmail(email, subject, htmlContent, { teacherName, password })
  console.warn('⚠️  Resend email service not configured. Email queued for later.')
  console.log(`📧 Email queued for: ${email}`)
  console.log(`   Email (Login ID): ${email}`)
  console.log(`   Password: ${password}`)
}

/**
 * Send email via Resend
 */
async function sendViaResend(email: string, subject: string, htmlContent: string): Promise<void> {
  if (!resend) {
    throw new Error('Resend not configured')
  }

  const response = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: email,
    subject,
    html: htmlContent,
  })

  if (response.error) {
    throw new Error(`Resend error: ${response.error.message}`)
  }
}

/**
 * Queue email for later retry when service becomes available
 */
async function queueEmail(
  toEmail: string, 
  subject: string, 
  htmlContent: string, 
  templateData?: any
): Promise<void> {
  try {
    await prisma.email_queue.create({
      data: {
        to_email: toEmail,
        subject,
        html_content: htmlContent,
        template_data: templateData || {},
        status: 'pending',
        attempts: 0,
      }
    })
  } catch (error) {
    console.error('Failed to queue email:', error)
    // Don't throw - queuing failure shouldn't break the main flow
  }
}

/**
 * Process queued emails - retry sending pending emails
 * Call this periodically (e.g., via cron job or scheduler)
 */
export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  if (!resend) {
    console.log('⚠️  Email service not configured. Skipping queue processing.')
    return { sent: 0, failed: 0 }
  }

  const MAX_ATTEMPTS = 5
  let sentCount = 0
  let failedCount = 0

  // Get pending emails (less than max attempts, ordered by oldest first)
  const pendingEmails = await prisma.email_queue.findMany({
    where: {
      status: 'pending',
      attempts: { lt: MAX_ATTEMPTS }
    },
    orderBy: { created_at: 'asc' },
    take: 50 // Process 50 at a time to avoid overwhelming the service
  })

  console.log(`📬 Processing ${pendingEmails.length} queued emails...`)

  for (const queuedEmail of pendingEmails) {
    try {
      await sendViaResend(queuedEmail.to_email, queuedEmail.subject, queuedEmail.html_content)
      
      // Mark as sent
      await prisma.email_queue.update({
        where: { id: queuedEmail.id },
        data: {
          status: 'sent',
          sent_at: new Date(),
          last_attempt: new Date(),
          attempts: queuedEmail.attempts + 1,
        }
      })
      
      sentCount++
      console.log(`✅ Sent queued email to: ${queuedEmail.to_email}`)
    } catch (error: any) {
      const newAttempts = queuedEmail.attempts + 1
      const status = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
      
      await prisma.email_queue.update({
        where: { id: queuedEmail.id },
        data: {
          status,
          attempts: newAttempts,
          last_attempt: new Date(),
          error_message: error?.message || 'Unknown error',
        }
      })
      
      if (status === 'failed') {
        failedCount++
        console.error(`❌ Failed to send email to ${queuedEmail.to_email} after ${MAX_ATTEMPTS} attempts`)
      } else {
        console.warn(`⚠️  Retry ${newAttempts} failed for ${queuedEmail.to_email}`)
      }
    }
  }

  console.log(`📊 Queue processing complete: ${sentCount} sent, ${failedCount} permanently failed`)
  return { sent: sentCount, failed: failedCount }
}

/**
 * Generate HTML email template for credentials
 */
function generateCredentialsEmailHTML(email: string, password: string, name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maestera - Teacher Account</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px;
        }
        .greeting {
            font-size: 18px;
            color: #333;
            margin-bottom: 20px;
        }
        .credentials-box {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .credential-item {
            margin-bottom: 15px;
        }
        .credential-label {
            font-size: 12px;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .credential-value {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            font-family: 'Monaco', 'Menlo', monospace;
            background-color: white;
            padding: 10px;
            border-radius: 4px;
            word-break: break-all;
        }
        .instructions {
            background-color: #fffbea;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
            font-size: 14px;
            color: #666;
        }
        .instructions h3 {
            margin-top: 0;
            color: #333;
        }
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .instructions li {
            margin-bottom: 8px;
        }
        .cta-button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 30px;
            border-radius: 4px;
            text-decoration: none;
            font-weight: 600;
            margin: 30px 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
        }
        .footer p {
            margin: 5px 0;
        }
        .security-note {
            background-color: #e8f4f8;
            border-left: 4px solid #17a2b8;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 Maestera</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Music Teaching Platform</p>
        </div>

        <div class="content">
            <div class="greeting">
                <strong>Hello ${escapeHtml(name)},</strong>
            </div>

            <p>Welcome to Maestera! Your teacher account has been successfully created by the admin. Below are your login credentials.</p>

            <div class="credentials-box">
                <div class="credential-item">
                    <div class="credential-label">Login ID (Email)</div>
                    <div class="credential-value">${escapeHtml(email)}</div>
                </div>

                <div class="credential-item">
                    <div class="credential-label">Password</div>
                    <div class="credential-value">${escapeHtml(password)}</div>
                </div>
            </div>

            <div class="security-note">
                <strong>🔒 Security Reminder:</strong> Please keep your password safe and do not share it with anyone. Consider changing your password after your first login.
            </div>

            <div class="instructions">
                <h3>📋 Next Steps:</h3>
                <ol>
                    <li>Visit the Maestera platform login page</li>
                    <li>Enter your email address and password above</li>
                    <li>Complete your teacher profile setup</li>
                    <li>Start accepting bookings from students</li>
                </ol>
            </div>

            <div style="text-align: center;">
                <a href="${process.env.TEACHER_LOGIN_URL || 'https://maestera.app/login'}" class="cta-button">
                    Sign In to Your Account
                </a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you didn't expect this email or have any questions, please contact our support team.
            </p>
        </div>

        <div class="footer">
            <p><strong>Maestera - Music Teaching Platform</strong></p>
            <p>© ${new Date().getFullYear()} Maestera. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>
  `
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Send custom transactional email
 * Primary: Supabase
 * Fallback: Resend
 * @param email - Recipient email
 * @param subject - Email subject
 * @param htmlContent - HTML content of the email
 */
export async function sendTransactionalEmail(
  email: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  // Try Resend as primary service
  if (resend) {
    try {
      await sendViaResend(email, subject, htmlContent)
      console.log(`✅ Email sent via Resend to: ${email}`)
      return
    } catch (error) {
      console.warn(`⚠️  Resend email failed:`, error)
    }
  }

  // Fallback to console logging
  console.warn(`⚠️  No email service configured. Email to ${email} logged to console`)

  console.warn('⚠️  No email service configured for sending to:', email)
}
