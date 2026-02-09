import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { supabaseAdmin } from '../config/supabase'
import prisma from '../config/database'
import { ConversationService } from '../services/conversation.service'
import logger from '../utils/logger'

let io: Server

/**
 * Authenticate a socket connection using the Supabase JWT from the handshake.
 * Returns { id, email, role } or throws.
 */
async function authenticateSocket(socket: Socket) {
  const token = socket.handshake.auth?.token as string | undefined

  if (!token) {
    throw new Error('No auth token provided')
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid token')
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: user.id },
  })

  if (!profile || !profile.is_active) {
    throw new Error('User not found or inactive')
  }

  return { id: user.id, email: user.email!, role: profile.role }
}

/**
 * Initialise Socket.IO on the given HTTP server and wire up all events.
 */
export function initSocketServer(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Prefer WebSocket, fall back to polling for old browsers / proxies
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
  })

  // ── Authentication middleware ────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket)
      // Attach user data so handlers can read it
      ;(socket as any).user = user
      next()
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Socket auth failed')
      next(new Error('Authentication failed'))
    }
  })

  // ── Connection handler ───────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as { id: string; email: string; role: string }
    logger.info({ userId: user.id, role: user.role }, '🔌 Socket connected')

    // Every user joins a private room keyed by their user ID so we can
    // push notifications / conversation-list updates even when they
    // haven't joined a specific conversation room.
    socket.join(`user:${user.id}`)

    // ── join_conversation ──────────────────────────────────────────────
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        // Verify the user belongs to this conversation
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId },
        })

        if (!conversation) {
          socket.emit('error_message', { message: 'Conversation not found' })
          return
        }

        const isAuthorised =
          (user.role === 'student' && conversation.student_id === user.id) ||
          (user.role === 'teacher' && conversation.teacher_id === user.id)

        if (!isAuthorised) {
          socket.emit('error_message', { message: 'Not authorised' })
          return
        }

        // Leave any previously-joined conversation rooms (keep user room)
        for (const room of socket.rooms) {
          if (room.startsWith('conversation:')) {
            socket.leave(room)
          }
        }

        socket.join(`conversation:${conversationId}`)
        logger.info({ userId: user.id, conversationId }, '📩 Joined conversation room')

        // Mark messages as read when joining
        await ConversationService.markAsRead(conversationId, user.id, user.role)

        // Notify the OTHER user that their messages were read
        const otherUserId =
          user.role === 'student' ? conversation.teacher_id : conversation.student_id
        io.to(`user:${otherUserId}`).emit('messages_read', { conversationId })

        socket.emit('joined_conversation', { conversationId })
      } catch (err: any) {
        logger.error({ err: err.message, conversationId }, 'Error joining conversation')
        socket.emit('error_message', { message: 'Failed to join conversation' })
      }
    })

    // ── leave_conversation ─────────────────────────────────────────────
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
      logger.info({ userId: user.id, conversationId }, '👋 Left conversation room')
    })

    // ── send_message ───────────────────────────────────────────────────
    socket.on('send_message', async (data: { conversationId: string; content: string }, ack?: (res: any) => void) => {
      const { conversationId, content } = data

      if (!content?.trim()) {
        if (ack) ack({ success: false, error: 'Message content is required' })
        return
      }

      try {
        const senderType = user.role as 'student' | 'teacher'
        const message = await ConversationService.sendMessage(
          conversationId,
          user.id,
          senderType,
          content,
        )

        // Emit to everyone in the conversation room (including sender for confirmation)
        io.to(`conversation:${conversationId}`).emit('receive_message', message)

        // Also push a conversation-list update to the OTHER user so their
        // sidebar shows the new message preview + unread badge instantly.
        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId },
        })

        if (conversation) {
          const otherUserId =
            senderType === 'student' ? conversation.teacher_id : conversation.student_id

          // Refresh unread count for the other user
          const unreadCount = await ConversationService.getUnreadCount(otherUserId, senderType === 'student' ? 'teacher' : 'student')

          io.to(`user:${otherUserId}`).emit('conversation_updated', {
            conversationId,
            last_message_preview:
              content.trim().length > 100
                ? content.trim().substring(0, 100) + '...'
                : content.trim(),
            last_message_at: message.created_at,
            unread_count_increment: 1,
          })

          io.to(`user:${otherUserId}`).emit('notification_update', {
            total_unread: unreadCount,
          })
        }

        if (ack) ack({ success: true, data: message })
      } catch (err: any) {
        logger.error({ err: err.message, conversationId }, 'Error sending message')
        if (ack) ack({ success: false, error: err.message })
      }
    })

    // ── mark_read ──────────────────────────────────────────────────────
    socket.on('mark_read', async (conversationId: string) => {
      try {
        await ConversationService.markAsRead(conversationId, user.id, user.role)

        const conversation = await prisma.conversations.findUnique({
          where: { id: conversationId },
        })

        if (conversation) {
          const otherUserId =
            user.role === 'student' ? conversation.teacher_id : conversation.student_id
          io.to(`user:${otherUserId}`).emit('messages_read', { conversationId })
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error marking read')
      }
    })

    // ── typing indicators ──────────────────────────────────────────────
    socket.on('typing_start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing_start', {
        userId: user.id,
        conversationId,
      })
    })

    socket.on('typing_stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing_stop', {
        userId: user.id,
        conversationId,
      })
    })

    // ── disconnect ─────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info({ userId: user.id, reason }, '🔌 Socket disconnected')
    })
  })

  logger.info('⚡ Socket.IO server initialised')
  return io
}

/** Get the running Socket.IO instance (for use in REST controllers if needed). */
export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialised')
  return io
}
