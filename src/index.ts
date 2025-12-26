// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config()

import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import logger from './utils/logger'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimiter'

const app: Application = express()
const PORT = process.env.PORT || 4000

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
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  })
)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate limiting
app.use(apiLimiter)

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`\n📡 [${timestamp}] ${req.method} ${req.path}`)
  next()
})

// Routes
app.use(routes)

// Error handlers (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('🎵  MAESTRA BACKEND API')
  console.log('='.repeat(60))
  console.log(`\n✅  Server running on: http://localhost:${PORT}`)
  console.log(`📝  Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐  CORS enabled for: ${allowedOrigins.length} origins`)
  console.log(`⏰  Started at: ${new Date().toLocaleString()}`)
  console.log('\n' + '='.repeat(60))
  console.log('📡  Endpoints:')
  console.log(`    GET  /health`)
  console.log(`    GET  /api/v1/test`)
  console.log('='.repeat(60) + '\n')
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

export default app
