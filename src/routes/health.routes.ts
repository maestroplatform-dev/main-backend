import { Router, Request, Response } from 'express'
import prisma from '../config/database'

const router = Router()

router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        message: 'Service unhealthy',
        code: 'UNHEALTHY',
      },
    })
  }
})

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Maestra API is running',
      version: '1.0.0',
      docs: '/api-docs',
    },
  })
})

export default router
