import { Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import prisma from '../config/database'
import { AuthRequest, AppError } from '../types'

// Validate Supabase token only (no profile required)
export async function validateSupabaseToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED')
    }

    const token = authHeader.substring(7)

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new AppError(401, 'Invalid token', 'INVALID_TOKEN')
    }

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
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED')
    }

    const token = authHeader.substring(7)

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new AppError(401, 'Invalid token', 'INVALID_TOKEN')
    }

    // Fetch user profile from database
    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
    })

    if (!profile || !profile.is_active) {
      throw new AppError(403, 'User not found or inactive', 'FORBIDDEN')
    }

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
