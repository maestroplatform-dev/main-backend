import { Router, Request, Response } from 'express'

const router = Router()

// Simple test endpoint - no auth required
router.get('/api/v1/test', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: 'Backend is connected! 🎉',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        teachers: '/api/v1/teachers (coming soon)',
        bookings: '/api/v1/bookings (coming soon)',
      },
    },
  })
})

// Echo endpoint - returns what you send
router.post('/api/v1/echo', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      received: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        authorization: req.headers.authorization ? 'Bearer token received' : 'No token',
      },
    },
  })
})

export default router
