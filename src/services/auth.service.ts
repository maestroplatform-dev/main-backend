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
    // Keep registration idempotent so partially-onboarded auth users can recover.
    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.profiles.findUnique({
        where: { id: userId },
      })

      let upsertedProfile
      if (!existing) {
        upsertedProfile = await tx.profiles.create({
          data: {
            id: userId,
            name,
            role,
            is_active: true,
          },
        })
      } else {
        if (existing.role !== role) {
          throw new AppError(409, 'Profile already exists with a different role', 'ROLE_MISMATCH')
        }

        upsertedProfile = await tx.profiles.update({
          where: { id: userId },
          data: {
            name: existing.name || name,
            is_active: true,
          },
        })
      }

      if (role === 'teacher') {
        await tx.teachers.upsert({
          where: { id: userId },
          update: {
            name,
          },
          create: {
            id: userId,
            name,
            verified: false,
          },
        })
      }

      if (role === 'student') {
        await tx.students.upsert({
          where: { id: userId },
          update: {
            name,
          },
          create: {
            id: userId,
            name,
          },
        })
      }

      return upsertedProfile
    })

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
