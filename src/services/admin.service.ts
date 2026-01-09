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
          subject: 'Your Maestera Teacher Account is Ready',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to Maestera, ${data.name}!</h2>
              <p>Your teacher account has been created and will be ready to use.</p>
              
              <h3>Login Credentials:</h3>
              <p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                <strong>Email:</strong> ${data.email}<br/>
                <strong>Password:</strong> ${tempPassword}
              </p>
              
              <p style="margin-top: 20px;">
                <a href="${teacherLoginUrl}" style="background: #DA2D2C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Login to Your Account
                </a>
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                Please keep these credentials safe and change your password after first login.
              </p>
            </div>
          `,
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

    // Calculate average rating for each teacher
    const teachersWithStats = teachers.map(teacher => {
      const avgRating = teacher.reviews.length > 0
        ? teacher.reviews.reduce((sum, r) => sum + r.rating, 0) / teacher.reviews.length
        : 0

      return {
        ...teacher,
        avgRating: Math.round(avgRating * 10) / 10,
      }
    })

    return {
      teachers: teachersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
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
