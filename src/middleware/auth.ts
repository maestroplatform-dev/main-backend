import { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabase'
import prisma from '../config/database'
import { AuthRequest, AppError } from '../types'
import logger from '../utils/logger'

async function validateBearerUser(req: AuthRequest) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED')
  }

  const token = authHeader.substring(7)
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    throw new AppError(401, 'Invalid token', 'INVALID_TOKEN')
  }

  return user
}

// Validate Supabase token only (no profile required)
export async function validateSupabaseToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await validateBearerUser(req)

    req.user = { id: user.id, email: user.email!, role: '' }
    next()
  } catch (error) {
    next(error)
  }
}

export async function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await validateBearerUser(req)

    // Fetch user profile from database
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
    })

    if (!profile) {
      logger.warn(
        { userId: user.id, email: user.email },
        'Profile not found for authenticated user'
      )
      throw new AppError(403, 'User profile not found', 'PROFILE_NOT_FOUND')
    }

    if (!profile.is_active) {
      throw new AppError(403, 'User account is inactive', 'USER_INACTIVE')
    }

    req.user = { id: user.id, email: user.email!, role: profile.role }
    next()
  } catch (error) {
    next(error)
  }
}

export async function authenticateStudentUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await validateBearerUser(req)

    let profile = await prisma.profiles.findUnique({
      where: { id: user.id },
    })

    if (!profile) {
      const fallbackName =
        (user.user_metadata?.name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        (user.email ? user.email.split('@')[0] : 'Student')

      profile = await prisma.profiles.create({
        data: {
          id: user.id,
          name: fallbackName,
          role: 'student',
          is_active: true,
        },
      })

      logger.warn(
        { userId: user.id, email: user.email },
        'Auto-provisioned missing profile for student user'
      )
    }

    if (!profile.is_active) {
      throw new AppError(403, 'User account is inactive', 'USER_INACTIVE')
    }

    if (profile.role !== 'student') {
      throw new AppError(403, 'Student access required', 'FORBIDDEN')
    }

    await prisma.students.upsert({
      where: { id: user.id },
      update: {
        name: profile.name,
      },
      create: {
        id: user.id,
        name: profile.name,
        signup_method: 'email',
      },
    })

    req.user = { id: user.id, email: user.email!, role: profile.role }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'))
    }
    next()
  }
}
