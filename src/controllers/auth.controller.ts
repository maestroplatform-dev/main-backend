import { Response } from 'express'
import { AuthRequest, AppError } from '../types'
import { AuthService } from '../services/auth.service'
import { registerSchema } from '../utils/validation'
import logger from '../utils/logger'

export class AuthController {
  // POST /api/v1/auth/register
  static async register(req: AuthRequest, res: Response) {
    logger.info({ 
      userId: req.user?.id, 
      email: req.user?.email,
      body: req.body 
    }, '🔵 Registration request received')
    const { name, role } = registerSchema.parse(req.body)
    // If creating an admin user, require a secret header to prevent abuse
    if (role === 'admin') {
      const adminSecret = process.env.ADMIN_CREATION_SECRET
      const provided = (req.headers['x-admin-secret'] as string) || ''

      if (!adminSecret) {
        throw new AppError(500, 'Admin creation not configured on server', 'ADMIN_CREATION_NOT_CONFIGURED')
      }

      if (!provided || provided !== adminSecret) {
        throw new AppError(403, 'Invalid admin creation secret', 'FORBIDDEN')
      }
    }

    const result = await AuthService.register(req.user!.id, req.user!.email, name, role)

    logger.info({ 
      userId: req.user!.id, 
      role, 
      name 
    }, '✅ Profile created successfully')

    res.status(201).json({
      success: true,
      data: {
        message: 'Profile created successfully',
        profile: result.profile,
        email: result.email,
        name: result.name,
      },
    })
  }

  // GET /api/v1/auth/me
  static async getCurrentUser(req: AuthRequest, res: Response) {
    const profile = await AuthService.getCurrentUser(req.user!.id)

    res.json({
      success: true,
      data: profile,
    })
  }
}
