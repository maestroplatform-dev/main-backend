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
    // Supabase pooler has a max of ~15 connections in Session mode
    // Keep pool very small to avoid exhaustion with concurrent requests
    max: 5,
    min: 1,
    // Connection timeout
    connectionTimeoutMillis: 5000,
    // Idle connections will be closed after 5 seconds
    idleTimeoutMillis: 5000,
    // Keep connection alive
    keepAlive: true,
    // Close idle connections to free up pool
    allowExitOnIdle: false,
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
