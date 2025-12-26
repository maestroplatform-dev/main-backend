import { supabase } from '../config/supabase'
import prisma from '../config/database'
import { AppError } from '../types'

export class AuthService {
  // Validate Supabase token and get user
  static async validateToken(token: string) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN')
    }

    return user
  }

  // Register user - create profile
  static async register(userId: string, email: string, role: string) {
    // Check if profile already exists
    const existing = await prisma.profiles.findUnique({
      where: { id: userId },
    })

    if (existing) {
      throw new AppError(409, 'Profile already exists', 'PROFILE_EXISTS')
    }

    // Create profile
    const profile = await prisma.profiles.create({
      data: {
        id: userId,
        role,
        is_active: true,
      },
    })

    // If teacher, create teacher record
    if (role === 'teacher') {
      await prisma.teachers.create({
        data: {
          id: userId,
          verified: false,
        },
      })
    }

    // If student, create student record
    if (role === 'student') {
      await prisma.students.create({
        data: {
          id: userId,
        },
      })
    }

    return { profile, email }
  }

  // Get current user profile
  static async getCurrentUser(userId: string) {
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      include: {
        students: true,
        teachers: true,
      },
    })

    if (!profile) {
      throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND')
    }

    return profile
  }
}
