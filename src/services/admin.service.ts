import prisma from '../config/database'
import { AppError } from '../types'

export class AdminService {
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
