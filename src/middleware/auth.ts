import { Response, NextFunction } from 'express'
import { createClient, User } from '@supabase/supabase-js'
import { supabaseAdmin } from '../config/supabase'
import prisma from '../config/database'
import { AuthRequest, AppError } from '../types'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const payload = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(payload)
  } catch {
    return null
  }
}

async function getSupabaseUserFromToken(token: string): Promise<User | null> {
  const primaryResult = await supabaseAdmin.auth.getUser(token)
  if (primaryResult.data.user) {
    return primaryResult.data.user
  }

  const payload = decodeJwtPayload(token)
  const tokenIssuer = typeof payload?.iss === 'string' ? payload.iss : ''
  if (!tokenIssuer.startsWith('http')) {
    return null
  }

  const issuerBaseUrl = tokenIssuer.replace(/\/auth\/v1\/?$/, '')
  const configuredUrl = process.env.SUPABASE_URL || ''

  if (!issuerBaseUrl || issuerBaseUrl === configuredUrl) {
    return null
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!serviceRoleKey) {
    return null
  }

  const issuerClient = createClient(issuerBaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const fallbackResult = await issuerClient.auth.getUser(token)
  return fallbackResult.data.user || null
}

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

    const user = await getSupabaseUserFromToken(token)
    if (!user) {
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

    const user = await getSupabaseUserFromToken(token)
    if (!user) {
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
