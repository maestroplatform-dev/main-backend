import { Response } from 'express'
import { AuthRequest } from '../types'
import { ConversationService } from '../services/conversation.service'

export class ConversationController {
  /**
   * POST /api/v1/conversations
   * Get or create a conversation between the current user and a teacher/student
   */
  static async getOrCreateConversation(req: AuthRequest, res: Response): Promise<void> {
    const { teacher_id, student_id } = req.body
    const userRole = req.user!.role

    let studentId: string
    let teacherId: string

    if (userRole === 'student') {
      if (!teacher_id) {
        res.status(400).json({ success: false, error: { message: 'teacher_id is required', code: 'MISSING_FIELD' } })
        return
      }
      studentId = req.user!.id
      teacherId = teacher_id
    } else if (userRole === 'teacher') {
      if (!student_id) {
        res.status(400).json({ success: false, error: { message: 'student_id is required', code: 'MISSING_FIELD' } })
        return
      }
      studentId = student_id
      teacherId = req.user!.id
    } else {
      res.status(403).json({ success: false, error: { message: 'Invalid role', code: 'FORBIDDEN' } })
      return
    }

    const conversation = await ConversationService.getOrCreateConversation(studentId, teacherId)

    res.json({ success: true, data: conversation })
  }

  /**
   * GET /api/v1/conversations
   * Get all conversations for the authenticated user
   */
  static async getConversations(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user!.id
    const userRole = req.user!.role

    let conversations
    if (userRole === 'student') {
      conversations = await ConversationService.getStudentConversations(userId)
    } else if (userRole === 'teacher') {
      conversations = await ConversationService.getTeacherConversations(userId)
    } else {
      res.status(403).json({ success: false, error: { message: 'Invalid role', code: 'FORBIDDEN' } })
      return
    }

    res.json({ success: true, data: conversations })
  }

  /**
   * GET /api/v1/conversations/:id/messages
   * Get messages for a conversation (paginated)
   */
  static async getMessages(req: AuthRequest, res: Response) {
    const { id } = req.params
    const { cursor, limit } = req.query
    const userId = req.user!.id
    const userRole = req.user!.role

    const result = await ConversationService.getMessages(
      id,
      userId,
      userRole,
      cursor as string | undefined,
      limit ? parseInt(limit as string, 10) : 50
    )

    res.json({ success: true, data: result })
  }

  /**
   * POST /api/v1/conversations/:id/messages
   * Send a message in a conversation
   */
  static async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user!.id
    const userRole = req.user!.role

    if (!content || !content.trim()) {
      res.status(400).json({ success: false, error: { message: 'Message content is required', code: 'MISSING_FIELD' } })
      return
    }

    const senderType = userRole as 'student' | 'teacher'
    const message = await ConversationService.sendMessage(id, userId, senderType, content)

    res.status(201).json({ success: true, data: message })
  }

  /**
   * PUT /api/v1/conversations/:id/read
   * Mark all messages in a conversation as read
   */
  static async markAsRead(req: AuthRequest, res: Response) {
    const { id } = req.params
    const userId = req.user!.id
    const userRole = req.user!.role

    await ConversationService.markAsRead(id, userId, userRole)

    res.json({ success: true, message: 'Messages marked as read' })
  }

  /**
   * GET /api/v1/conversations/unread-count
   * Get total unread message count for the authenticated user
   */
  static async getUnreadCount(req: AuthRequest, res: Response) {
    const userId = req.user!.id
    const userRole = req.user!.role

    const count = await ConversationService.getUnreadCount(userId, userRole)

    res.json({ success: true, data: { unread_count: count } })
  }
}
