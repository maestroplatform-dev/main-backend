import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables')
}

const parseIntEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Declare global type to hold the singleton Prisma instance
declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined
}

/**
 * Singleton Prisma client to prevent connection exhaustion
 * in hot-reload environments (development) and pooling-limited
 * production environments (Render / Supabase / Neon).
 */
function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production'
  const poolMax = parseIntEnv(process.env.PG_POOL_MAX, isProduction ? 4 : 8)
  const poolMin = parseIntEnv(process.env.PG_POOL_MIN, 0)
  const connectionTimeoutMillis = parseIntEnv(process.env.PG_CONNECTION_TIMEOUT_MS, 10000)
  const idleTimeoutMillis = parseIntEnv(process.env.PG_IDLE_TIMEOUT_MS, 30000)

  const pool = new Pool({ 
    connectionString,
    // Supabase requires SSL — pg ignores ?sslmode=require from the URL
    ssl: { rejectUnauthorized: false },
    // Supabase pooler has a max of ~15 connections in Session mode
    // Keep pool small but allow enough for concurrent requests
    max: poolMax,
    // Start with 0 — lazy-create connections as needed
    // Avoids cold-start failures when Supabase pooler is slow to respond
    min: poolMin,
    // Connection timeout — generous for cold starts on Render → Supabase
    connectionTimeoutMillis,
    // Idle connections will be closed after 30 seconds
    idleTimeoutMillis,
    // Keep connection alive
    keepAlive: true,
    // Close idle connections to free up pool
    allowExitOnIdle: false,
  })

  // Log pool errors so they don't crash the process silently
  pool.on('error', (err) => {
    console.error('⚠️ Unexpected PG pool error:', {
      message: err.message,
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      max: pool.options.max,
      min: pool.options.min,
      connectionTimeoutMillis: pool.options.connectionTimeoutMillis,
      idleTimeoutMillis: pool.options.idleTimeoutMillis,
    })
  })

  console.log('🗄️ PG pool config:', {
    max: pool.options.max,
    min: pool.options.min,
    connectionTimeoutMillis: pool.options.connectionTimeoutMillis,
    idleTimeoutMillis: pool.options.idleTimeoutMillis,
  })

  const adapter = new PrismaPg(pool)

  const client = new PrismaClient({
    adapter,
    // Only log errors (and warnings in dev) to avoid noisy SQL output
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  // Warm up the connection pool with a retry so the first real request isn't slow
  const warmUp = async (attempt = 1) => {
    try {
      await pool.query('SELECT 1')
      console.log('✅ Database connection pool warmed up')
    } catch (err: any) {
      if (attempt <= 3) {
        const delay = attempt * 2000 // 2s, 4s, 6s
        console.warn(`⚠️ DB warmup attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`)
        setTimeout(() => warmUp(attempt + 1), delay)
      } else {
        console.error('❌ DB warmup failed after 3 attempts. Connections will be created lazily on first request.')
      }
    }
  }
  warmUp()

  return client
}

// Reuse existing instance in dev (globalThis persists across hot reloads)
const prisma: PrismaClient = globalThis.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClient = prisma
}

export default prisma
