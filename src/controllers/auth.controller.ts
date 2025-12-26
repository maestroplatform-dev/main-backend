import { Response } from 'express'
import { AuthRequest } from '../types'
import { AuthService } from '../services/auth.service'
import { registerSchema } from '../utils/validation'

export class AuthController {
  // POST /api/v1/auth/register
  static async register(req: AuthRequest, res: Response) {
    const { role } = registerSchema.parse(req.body)
    
    const result = await AuthService.register(
      req.user!.id,
      req.user!.email,
      role
    )

    res.status(201).json({
      success: true,
      data: {
        message: 'Profile created successfully',
        profile: result.profile,
        email: result.email,
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
