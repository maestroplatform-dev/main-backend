import prisma from '../config/database'
import { AppError } from '../types'

export class ConversationService {
  /**
   * Get or create a conversation between a student and teacher
   */
  static async getOrCreateConversation(studentId: string, teacherId: string) {
    // Check if conversation already exists
    let conversation = await prisma.conversations.findUnique({
      where: {
        student_id_teacher_id: {
          student_id: studentId,
          teacher_id: teacherId,
        },
      },
      include: {
        teachers: {
          select: { id: true, name: true, profile_picture: true },
        },
        students: {
          select: { id: true, name: true, profile_picture_url: true },
        },
      },
    })

    if (!conversation) {
      // Verify student exists
      const student = await prisma.students.findUnique({
        where: { id: studentId },
        select: { id: true },
      })
      if (!student) {
        throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND')
      }

      // Verify teacher exists
      const teacher = await prisma.teachers.findUnique({
        where: { id: teacherId },
      })
      if (!teacher) {
        throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
      }

      conversation = await prisma.conversations.create({
        data: {
          student_id: studentId,
          teacher_id: teacherId,
        },
        include: {
          teachers: {
            select: { id: true, name: true, profile_picture: true },
          },
          students: {
            select: { id: true, name: true, profile_picture_url: true },
          },
        },
      })
    }

    return conversation
  }

  /**
   * Get all conversations for a student
   */
  static async getStudentConversations(studentId: string) {
    const conversations = await prisma.conversations.findMany({
      where: { student_id: studentId },
      include: {
        teachers: {
          select: {
            id: true,
            name: true,
            profile_picture: true,
            teacher_instruments: {
              select: { instrument: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { last_message_at: { sort: 'desc', nulls: 'last' } },
        { created_at: 'desc' },
      ],
    })

    return conversations.map((c) => ({
      id: c.id,
      teacher_id: c.teacher_id,
      teacher_name: c.teachers.name || 'Teacher',
      teacher_avatar: c.teachers.profile_picture,
      teacher_instrument: c.teachers.teacher_instruments[0]?.instrument || 'Music',
      last_message_preview: c.last_message_preview,
      last_message_at: c.last_message_at,
      unread_count: c.student_unread_count,
      created_at: c.created_at,
    }))
  }

  /**
   * Get all conversations for a teacher
   */
  static async getTeacherConversations(teacherId: string) {
    const conversations = await prisma.conversations.findMany({
      where: { teacher_id: teacherId },
      include: {
        students: {
          select: { id: true, name: true, profile_picture_url: true },
        },
      },
      orderBy: [
        { last_message_at: { sort: 'desc', nulls: 'last' } },
        { created_at: 'desc' },
      ],
    })

    return conversations.map((c) => ({
      id: c.id,
      student_id: c.student_id,
      student_name: c.students.name || 'Student',
      student_avatar: c.students.profile_picture_url,
      last_message_preview: c.last_message_preview,
      last_message_at: c.last_message_at,
      unread_count: c.teacher_unread_count,
      created_at: c.created_at,
    }))
  }

  /**
   * Get messages for a conversation (paginated)
   */
  static async getMessages(
    conversationId: string,
    userId: string,
    userRole: string,
    cursor?: string,
    limit: number = 50
  ) {
    // Verify the user is part of this conversation
    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    })

    if (!conversation) {
      throw new AppError(404, 'Conversation not found', 'NOT_FOUND')
    }

    if (
      (userRole === 'student' && conversation.student_id !== userId) ||
      (userRole === 'teacher' && conversation.teacher_id !== userId)
    ) {
      throw new AppError(403, 'Not authorized to view this conversation', 'FORBIDDEN')
    }

    const messages = await prisma.messages.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    })

    const hasMore = messages.length > limit
    if (hasMore) messages.pop()

    // Reverse to get chronological order
    messages.reverse()

    return {
      messages: messages.map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        sender_type: m.sender_type,
        content: m.content,
        is_read: m.is_read,
        created_at: m.created_at,
      })),
      has_more: hasMore,
      next_cursor: hasMore ? messages[0]?.id : null,
    }
  }

  /**
   * Send a message in a conversation
   */
  static async sendMessage(
    conversationId: string,
    senderId: string,
    senderType: 'student' | 'teacher',
    content: string
  ) {
    // Verify conversation exists and sender belongs to it
    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    })

    if (!conversation) {
      throw new AppError(404, 'Conversation not found', 'NOT_FOUND')
    }

    if (
      (senderType === 'student' && conversation.student_id !== senderId) ||
      (senderType === 'teacher' && conversation.teacher_id !== senderId)
    ) {
      throw new AppError(403, 'Not authorized to send messages in this conversation', 'FORBIDDEN')
    }

    // Create message and update conversation in a transaction
    const [message] = await prisma.$transaction([
      prisma.messages.create({
        data: {
          conversation_id: conversationId,
          sender_id: senderId,
          sender_type: senderType,
          content: content.trim(),
        },
      }),
      prisma.conversations.update({
        where: { id: conversationId },
        data: {
          last_message_at: new Date(),
          last_message_preview:
            content.trim().length > 100
              ? content.trim().substring(0, 100) + '...'
              : content.trim(),
          updated_at: new Date(),
          // Increment unread count for the OTHER party
          ...(senderType === 'student'
            ? { teacher_unread_count: { increment: 1 } }
            : { student_unread_count: { increment: 1 } }),
        },
      }),
    ])

    return {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      sender_type: message.sender_type,
      content: message.content,
      is_read: message.is_read,
      created_at: message.created_at,
    }
  }

  /**
   * Mark all messages in a conversation as read for the given user
   */
  static async markAsRead(conversationId: string, userId: string, userRole: string) {
    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    })

    if (!conversation) {
      throw new AppError(404, 'Conversation not found', 'NOT_FOUND')
    }

    if (
      (userRole === 'student' && conversation.student_id !== userId) ||
      (userRole === 'teacher' && conversation.teacher_id !== userId)
    ) {
      throw new AppError(403, 'Not authorized', 'FORBIDDEN')
    }

    // The opposite sender_type is whose messages we're marking as read
    const oppositeSenderType = userRole === 'student' ? 'teacher' : 'student'

    await prisma.$transaction([
      // Mark unread messages from the other party as read
      prisma.messages.updateMany({
        where: {
          conversation_id: conversationId,
          sender_type: oppositeSenderType as any,
          is_read: false,
        },
        data: { is_read: true },
      }),
      // Reset unread count for the current user
      prisma.conversations.update({
        where: { id: conversationId },
        data: {
          ...(userRole === 'student'
            ? { student_unread_count: 0 }
            : { teacher_unread_count: 0 }),
          updated_at: new Date(),
        },
      }),
    ])

    return { success: true }
  }

  /**
   * Get total unread message count for a user
   */
  static async getUnreadCount(userId: string, userRole: string) {
    if (userRole === 'student') {
      const result = await prisma.conversations.aggregate({
        where: { student_id: userId },
        _sum: { student_unread_count: true },
      })
      return result._sum.student_unread_count || 0
    } else {
      const result = await prisma.conversations.aggregate({
        where: { teacher_id: userId },
        _sum: { teacher_unread_count: true },
      })
      return result._sum.teacher_unread_count || 0
    }
  }
}
