import { Router } from 'express'
import { ConversationController } from '../controllers/conversation.controller'
import { authenticateUser } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'
import { chatPollingLimiter } from '../middleware/rateLimiter'

const router = Router()

// Apply lenient rate limiter to conversation routes (for polling)
router.use(chatPollingLimiter)

/**
 * GET /api/v1/conversations/unread-count
 * Get total unread count (must come BEFORE :id routes)
 */
router.get(
  '/unread-count',
  authenticateUser,
  asyncHandler(ConversationController.getUnreadCount)
)

/**
 * GET /api/v1/conversations
 * List all conversations for the current user
 */
router.get(
  '/',
  authenticateUser,
  asyncHandler(ConversationController.getConversations)
)

/**
 * POST /api/v1/conversations
 * Get or create a conversation
 */
router.post(
  '/',
  authenticateUser,
  asyncHandler(ConversationController.getOrCreateConversation)
)

/**
 * GET /api/v1/conversations/:id/messages
 * Get messages for a conversation
 */
router.get(
  '/:id/messages',
  authenticateUser,
  asyncHandler(ConversationController.getMessages)
)

/**
 * POST /api/v1/conversations/:id/messages
 * Send a message in a conversation
 */
router.post(
  '/:id/messages',
  authenticateUser,
  asyncHandler(ConversationController.sendMessage)
)

/**
 * PUT /api/v1/conversations/:id/read
 * Mark conversation as read
 */
router.put(
  '/:id/read',
  authenticateUser,
  asyncHandler(ConversationController.markAsRead)
)

export default router
