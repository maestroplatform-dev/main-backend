import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables')
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
  const pool = new Pool({ 
    connectionString,
    // Keep connection alive
    keepAlive: true,
    idleTimeoutMillis: 0,
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    // Only log errors (and warnings in dev) to avoid noisy SQL output
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// Reuse existing instance in dev (globalThis persists across hot reloads)
const prisma: PrismaClient = globalThis.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClient = prisma
}

export default prisma
