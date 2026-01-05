import pino from 'pino'

const logger = pino({
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss',
            messageFormat: '{msg}',
          },
        }
      : undefined,
  level: process.env.LOG_LEVEL || 'info',
})

export default logger
