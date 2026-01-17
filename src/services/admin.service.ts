import prisma from '../config/database'
import { AppError } from '../types'
import { createClient } from '@supabase/supabase-js'
import { TeacherOnboardingService } from './teacher-onboarding.service'
import { AuthService } from './auth.service'
import { z } from 'zod'
import { teacherCompleteOnboardingSchema } from '../utils/validation'
import { Resend } from 'resend'
import logger from '../utils/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

type TeacherOnboardingInput = z.infer<typeof teacherCompleteOnboardingSchema>

export class AdminService {
  // Register a new teacher as admin (creates user, profile, and onboards)
  static async registerTeacher(
    adminId: string,
    data: TeacherOnboardingInput & { email: string; name: string }
  ) {
    // Initialize Supabase admin client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Step 1: Create user in Supabase
    const tempPassword = Math.random().toString(36).slice(-12)
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
    })

    if (signUpError) {
      throw new AppError(400, signUpError.message, 'USER_CREATION_FAILED')
    }

    const teacherId = signUpData.user.id

    // Step 2: Create profile in database
    await AuthService.register(teacherId, data.email, data.name, 'teacher')

    // Step 3: Complete teacher onboarding
    const teacher = await TeacherOnboardingService.completeOnboarding(teacherId, data)

    // Step 4: Send credentials email
    try {
      const teacherLoginUrl = process.env.TEACHER_LOGIN_URL || 'https://teacher.maestera.app/login'
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@maestera.com',
        to: data.email,
        subject: 'Maestera – Your Teacher Account',
        html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Maestera – Your Teacher Account</title>
  </head>
  <body style="margin:0; padding:0; background-color:#0b0b0b; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b0b; padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#121212; border-radius:12px; overflow:hidden; box-shadow:0 0 30px rgba(255,0,0,0.15);">

            <!-- Header with Logo -->
            <tr>
              <td style="background:linear-gradient(135deg,#b30000,#ff1a1a); padding:30px; text-align:center;">
                <img 
                  src="https://sojdmotuicmshiodtytf.supabase.co/storage/v1/object/sign/image%20storage/logo-main-w.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iMzEyMTQwOC1mMmMyLTRhYTItYTNmNy1hMzAyMThkNDEzNjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZSBzdG9yYWdlL2xvZ28tbWFpbi13LnBuZyIsImlhdCI6MTc2Nzk5MzU2NSwiZXhwIjoxNzk5NTI5NTY1fQ.i-pckYiLgybaLC5Z8qhmbItKEnHwNRxZDGXuUphkuO4"
                  alt="Maestera Logo"
                  width="140"
                  style="display:block; margin:0 auto 15px auto;"
                />
                <h1 style="margin:0; color:#ffffff; letter-spacing:2px; font-size:24px;">Teacher Portal Access</h1>
                
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px; color:#ffffff;">
                <h2 style="margin-top:0; color:#ff4d4d;">Hey ${data.name},</h2>

                <p style="line-height:1.7; color:#dddddd; font-size:15px;">
                  Your Maestera <strong>Teacher Account</strong> has been created!  
                  Below are your login credentials for the Teacher Portal:
                </p>

                <!-- Credentials Box -->
                <div style="background:#0f0f0f; border:1px solid #ff1a1a; border-radius:8px; padding:20px; margin:25px 0; font-size:15px;">
                  <p style="margin:0; color:#aaaaaa;">📧 <strong>Login ID</strong></p>
                  <p style="margin:5px 0 15px; font-weight:bold; color:#ffffff;">${data.email}</p>

                  <p style="margin:0; color:#aaaaaa;">🔑 <strong>Password</strong></p>
                  <p style="margin:5px 0; font-weight:bold; color:#ffffff;">${tempPassword}</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align:center; margin:35px 0;">
                  <a href="${teacherLoginUrl}" target="_blank"
                     style="background:linear-gradient(135deg,#ff1a1a,#b30000);
                            color:#ffffff;
                            text-decoration:none;
                            padding:15px 35px;
                            border-radius:30px;
                            font-weight:bold;
                            font-size:16px;
                            display:inline-block;
                            box-shadow:0 8px 20px rgba(255,0,0,0.4);">
                    Visit Teacher Dashboard
                  </a>
                </div>

                <!-- Under Development Notice -->
                <div style="background:#1a1a1a; border-left:4px solid #ff1a1a; padding:20px; border-radius:6px; font-size:14px;">
                  <p style="margin:0; color:#ffb3b3; font-weight:bold;">🚧 Platform Under Development</p>
                  <p style="margin:10px 0 0; color:#cccccc; line-height:1.6;">
                    The Teacher Dashboard is currently under development,  
                    so you won't be able to log in just yet.
                    <br><br>
                    As soon as the site is live, you'll receive an automatic notification email 🎉
                  </p>
                </div>

                <p style="margin-top:35px; color:#aaaaaa; line-height:1.7; font-size:14px;">
                  Thanks for joining the Maestera community.  
                  If you ever have questions, just reply — we're here to help!
                </p>

                <p style="margin-top:25px; color:#ffffff; font-size:15px;">
                  — <strong style="color:#ff1a1a;">Team Maestera</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#0b0b0b; padding:18px; text-align:center; color:#666666; font-size:12px;">
                © 2026 Maestera. All rights reserved.<br>
                Please don't share your login information with anyone.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      })
      logger.info({
        teacherId,
        email: data.email,
        resendId: result.data?.id,
        resendError: result.error,
        from: process.env.RESEND_FROM_EMAIL
      }, '✅ Credentials email sent')
    } catch (emailError) {
      logger.error({ teacherId, email: data.email, error: emailError }, '⚠️ Failed to send credentials email')
      // Don't throw - let the registration succeed even if email fails
    }

    return {
      credentials: {
        email: data.email,
        password: tempPassword,
      },
      teacher,
    }
  }

  // Get dashboard statistics
  static async getDashboardStats() {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      verifiedTeachers,
      pendingTeachers,
      totalBookings,
      completedBookings,
      totalRevenue,
      recentSignups,
    ] = await Promise.all([
      // Total users
      prisma.profiles.count(),

      // Total teachers
      prisma.teachers.count(),

      // Total students
      prisma.students.count(),

      // Verified teachers
      prisma.teachers.count({ where: { verified: true } }),

      // Pending teachers (completed onboarding but not verified)
      prisma.teachers.count({
        where: {
          onboarding_completed: true,
          verified: false
        }
      }),

      // Total bookings
      prisma.bookings.count(),

      // Completed bookings
      prisma.bookings.count({ where: { status: 'completed' } }),

      // Total revenue
      prisma.payments.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true }
      }),

      // Users signed up in last 7 days
      prisma.profiles.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
    ])

    return {
      users: {
        total: totalUsers,
        teachers: totalTeachers,
        students: totalStudents,
        recentSignups,
      },
      teachers: {
        total: totalTeachers,
        verified: verifiedTeachers,
        pending: pendingTeachers,
        verificationRate: totalTeachers > 0
          ? Math.round((verifiedTeachers / totalTeachers) * 100)
          : 0,
      },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        completionRate: totalBookings > 0
          ? Math.round((completedBookings / totalBookings) * 100)
          : 0,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
      },
    }
  }

  // Get all teachers with filters
  static async getTeachers(params: {
    verified?: string
    onboarding_completed?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const page = params.page || 1
    const limit = params.limit || 20
    const skip = (page - 1) * limit

    const where: any = {}

    if (params.verified !== undefined) {
      where.verified = params.verified === 'true'
    }

    if (params.onboarding_completed !== undefined) {
      where.onboarding_completed = params.onboarding_completed === 'true'
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { bio: { contains: params.search, mode: 'insensitive' } },
        { current_city: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    const [teachers, total] = await Promise.all([
      prisma.teachers.findMany({
        where,
        skip,
        take: limit,
        include: {
          profiles: {
            select: {
              name: true,
              is_active: true,
              created_at: true,
            }
          },
          teacher_instruments: {
            select: {
              instrument: true,
              teach_or_perform: true,
              base_price: true,
              teacher_instrument_tiers: {
                select: {
                  level: true,
                  mode: true,
                  price_inr: true,
                  price_foreign: true,
                }
              }
            }
          },
          reviews: {
            select: {
              rating: true,
            }
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.teachers.count({ where }),
    ])

    // Calculate average rating and starting price for each teacher
    const teachersWithStats = teachers.map((teacher: any) => {
      const avgRating = teacher.reviews.length > 0
        ? teacher.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / teacher.reviews.length
        : 0;

      // Find minimum price from all teacher_instrument_tiers
      let minPrice: number | null = null;
      if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
        teacher.teacher_instruments.forEach((inst: any) => {
          if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
            inst.teacher_instrument_tiers.forEach((tier: any) => {
              const price = tier.price_inr && typeof tier.price_inr === 'object' && typeof tier.price_inr.toNumber === 'function'
                ? tier.price_inr.toNumber()
                : typeof tier.price_inr === 'number' ? tier.price_inr : null;
              if (price !== null && (minPrice === null || price < minPrice)) {
                minPrice = price;
              }
            });
          }
          // fallback to base_price if no tiers
          const basePrice = inst.base_price && typeof inst.base_price === 'object' && typeof inst.base_price.toNumber === 'function'
            ? inst.base_price.toNumber()
            : typeof inst.base_price === 'number' ? inst.base_price : null;
          if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
            minPrice = basePrice;
          }
        });
      }

      return {
        ...teacher,
        avgRating: Math.round(avgRating * 10) / 10,
        starting_price: minPrice,
      };
    });

    return {
      teachers: teachersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Verify/Unverify teacher
  static async updateTeacherVerification(teacherId: string, verified: boolean) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: { profiles: true },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: { verified, updated_at: new Date() },
      include: {
        profiles: true,
      },
    })

    return updated
  }

    // Get detailed teacher information
    static async getTeacherDetails(teacherId: string) {
      const teacher = await prisma.teachers.findUnique({
        where: { id: teacherId },
        include: {
          profiles: {
            select: {
              name: true,
              is_active: true,
              created_at: true,
              users: {
                select: {
                  email: true,
                }
              }
            }
          },
          teacher_languages: {
            select: {
              language: true,
            }
          },
          teacher_engagements: {
            select: {
              engagement_type: true,
              collaborative_projects: true,
              collaborative_other: true,
              performance_fee_per_hour: true,
            }
          },
          teacher_formats: {
            select: {
              class_formats: true,
              class_formats_other: true,
              exam_training: true,
              exam_training_other: true,
              additional_formats: true,
              additional_formats_other: true,
              learner_groups: true,
              learner_groups_other: true,
              performance_settings: true,
              performance_settings_other: true,
              other_contribution: true,
            }
          },
          teacher_instruments: {
            select: {
              id: true,
              instrument: true,
              teach_or_perform: true,
              class_mode: true,
              base_price: true,
              performance_fee_inr: true,
              performance_fee_foreign: true,
              teacher_instrument_tiers: {
                select: {
                  level: true,
                  mode: true,
                  price_inr: true,
                  price_foreign: true,
                }
              }
            }
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              created_at: true,
              students: {
                select: {
                  profiles: {
                    select: {
                      name: true,
                    }
                  }
                }
              }
            },
            orderBy: { created_at: 'desc' },
            take: 10,
          },
          bookings: {
            select: {
              id: true,
              status: true,
              created_at: true,
              scheduled_at: true,
              duration_minutes: true,
              students: {
                select: {
                  profiles: {
                    select: {
                      name: true,
                    }
                  }
                }
              }
            },
            orderBy: { created_at: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              bookings: true,
              reviews: true,
            }
          }
        }
      }) as any

      if (!teacher) {
        throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
      }

      // Calculate statistics
      const avgRating = teacher.reviews && teacher.reviews.length > 0
        ? teacher.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / teacher.reviews.length
        : 0

      // Find minimum price from all teacher_instrument_tiers
      let minPrice: number | null = null;
      if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
        teacher.teacher_instruments.forEach((inst: any) => {
          if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
            inst.teacher_instrument_tiers.forEach((tier: any) => {
              const price = tier.price_inr && typeof tier.price_inr === 'object' && typeof tier.price_inr.toNumber === 'function'
                ? tier.price_inr.toNumber()
                : typeof tier.price_inr === 'number' ? tier.price_inr : null;
              if (price !== null && (minPrice === null || price < minPrice)) {
                minPrice = price;
              }
            });
          }
          // fallback to base_price if no tiers
          const basePrice = inst.base_price && typeof inst.base_price === 'object' && typeof inst.base_price.toNumber === 'function'
            ? inst.base_price.toNumber()
            : typeof inst.base_price === 'number' ? inst.base_price : null;
          if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
            minPrice = basePrice;
          }
        });
      }

      return {
        ...teacher,
        teacher_instruments: teacher.teacher_instruments?.map((inst: any) => ({
          id: inst.id,
          instrument: inst.instrument,
          teach_or_perform: inst.teach_or_perform,
          class_mode: inst.class_mode,
          performance_fee_inr: inst.performance_fee_inr,
          tiers: inst.teacher_instrument_tiers?.map((tier: any) => ({
            level: tier.level,
            price_inr: tier.price_inr && typeof tier.price_inr === 'object' && typeof tier.price_inr.toNumber === 'function'
              ? tier.price_inr.toNumber()
              : tier.price_inr,
          })) || [],
        })) || [],
        statistics: {
          totalBookings: teacher._count?.bookings || 0,
          totalReviews: teacher._count?.reviews || 0,
          averageRating: Math.round(avgRating * 10) / 10,
        },
        languages: teacher.teacher_languages?.map((l: any) => l.language) || [],
        engagement: teacher.teacher_engagements || null,
        formats: teacher.teacher_formats || null,
        starting_price: minPrice,
      };
    }
  // Get all users with filters
  static async getUsers(params: {
    role?: string
    is_active?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const page = params.page || 1
    const limit = params.limit || 20
    const skip = (page - 1) * limit

    const where: any = {}

    if (params.role) {
      where.role = params.role
    }

    if (params.is_active !== undefined) {
      where.is_active = params.is_active === 'true'
    }

    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' }
    }

    const [users, total] = await Promise.all([
      prisma.profiles.findMany({
        where,
        skip,
        take: limit,
        include: {
          users: {
            select: {
              email: true,
              created_at: true,
              last_sign_in_at: true,
            }
          },
          teachers: {
            select: {
              verified: true,
              onboarding_completed: true,
            }
          },
          students: {
            select: {
              id: true,
            }
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.profiles.count({ where }),
    ])

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // Update user active status
  static async updateUserStatus(userId: string, isActive: boolean) {
    const user = await prisma.profiles.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const updated = await prisma.profiles.update({
      where: { id: userId },
      data: { is_active: isActive },
    })

    return updated
  }

  // Get audit logs
  static async getAuditLogs(params: {
    page?: number
    limit?: number
  }) {
    const page = params.page || 1
    const limit = params.limit || 50
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.audit_log_entries.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.audit_log_entries.count(),
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
