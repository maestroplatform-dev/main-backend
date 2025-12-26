import { Request } from 'express'

export interface AuthUser {
  id: string
  email: string
  role: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'ERROR'
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}
