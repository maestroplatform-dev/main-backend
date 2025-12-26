import { Request, Response, NextFunction } from 'express'
import { AppError } from '../types'
import logger from '../utils/logger'

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const timestamp = new Date().toLocaleTimeString()
  console.error(`\n❌ [${timestamp}] ERROR: ${err.message}`)
  console.error(`   Path: ${req.method} ${req.path}`)
  if (process.env.NODE_ENV === 'development') {
    console.error(`   Stack: ${err.stack?.split('\\n')[1]?.trim()}`)
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    })
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  })
}

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  })
}
