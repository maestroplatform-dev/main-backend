import { supabase } from '../config/supabase'
import prisma from '../config/database'
import { AppError } from '../types'
import logger from '../utils/logger'
import { randomUUID } from 'crypto'

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
  static async register(userId: string, email: string, name: string, role: string) {
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
        name,
        role,
        is_active: true,
      },
    })

    // If teacher, create teacher record
    if (role === 'teacher') {
      await prisma.teachers.create({
        data: {
          id: userId,
            name,
          verified: false,
        },
      })
    }

    // If student, create student record
    if (role === 'student') {
      await prisma.students.create({
        data: {
          id: userId,
            name,
        },
      })
    }

    // Audit log for admin creation
    if (role === 'admin') {
      try {
        const auditId = randomUUID()
        await prisma.audit_log_entries.create({
          data: {
            id: auditId,
            instance_id: null,
            payload: {
              action: 'create_admin',
              userId,
              email,
              timestamp: new Date().toISOString(),
            },
            ip_address: '',
          },
        })
      } catch (e) {
        // Log but do not block creation on audit failures
        logger.error('Failed to write admin audit log')
      }
    }

    return { profile, email, name }
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
