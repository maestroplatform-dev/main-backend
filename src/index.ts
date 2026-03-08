// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config({ override: true })

import { createServer } from 'http'
import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import logger from './utils/logger'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimiter'
import requestLogger from './middleware/requestLogger'
import { initSocketServer } from './socket'
import { ReminderSchedulerService } from './services/reminder-scheduler.service'

const app: Application = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 4000

// Trust proxy — required for Render, Railway, Heroku etc.
// Enables express-rate-limit to read X-Forwarded-For correctly
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        logger.warn({ origin, allowedOrigins }, 'CORS: Origin not allowed')
        callback(null, false) // Don't throw error, just deny
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
    maxAge: 86400, // Cache preflight for 24h to reduce OPTIONS requests
  })
)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting (skip for conversation routes — they have their own chatPollingLimiter)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/conversations')) return next()
  return apiLimiter(req, res, next)
})

// Request logging (structured)
app.use(requestLogger)

// Routes
app.use(routes)

// Error handlers (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// Initialise Socket.IO on the shared HTTP server
initSocketServer(httpServer, allowedOrigins)

// Start server
const server = httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('🎵  MAESTRA BACKEND API')
  console.log('='.repeat(60))
  console.log(`\n✅  Server running on: http://localhost:${PORT}`)
  console.log(`📝  Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐  CORS enabled for: ${allowedOrigins.length} origins`)
  console.log(`⚡  Socket.IO WebSocket server active`)
  console.log(`⏰  Started at: ${new Date().toLocaleString()}`)
  console.log('\n' + '='.repeat(60))
  console.log('📡  Endpoints:')
  console.log(`    GET  /health`)
  console.log(`    GET  /api/v1/test`)
  console.log('='.repeat(60) + '\n')

  // Start reminder cron scheduler
  ReminderSchedulerService.start()
})

// Keep server reference to prevent garbage collection
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use`)
    process.exit(1)
  }
  throw error
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...')
  process.exit(0)
})

// Catch unhandled errors
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

export default app
