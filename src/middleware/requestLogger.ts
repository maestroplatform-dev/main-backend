import { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'
import { randomUUID } from 'crypto'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers['x-request-id'] as string | undefined
  const reqId = incomingId || randomUUID()

  // attach id to response so clients can correlate
  if (!res.getHeader('X-Request-Id')) {
    res.setHeader('X-Request-Id', reqId)
  }

  const start = process.hrtime.bigint()
  const ts = new Date().toISOString()

  logger.info({ reqId, ts, method: req.method, path: req.path }, `→ ${req.method} ${req.path}`)

  res.once('finish', () => {
    const diff = Number(process.hrtime.bigint() - start) / 1e6
    const durationMs = Math.round(diff * 100) / 100
    const meta = {
      reqId,
      ts,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    }

    if (res.statusCode >= 500) {
      logger.error(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`)
    } else if (res.statusCode >= 400) {
      logger.warn(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`)
    } else {
      logger.info(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`)
    }
  })

  next()
}

export default requestLogger
