import prisma from '../config/database'

export class NotificationService {
  /**
   * Get all notifications for a teacher (newest first)
   */
  static async getNotifications(teacherId: string, limit = 50, offset = 0) {
    // Use a single query for notifications + count via Prisma transaction
    // to avoid using 3 parallel connections
    const whereAll = { teacher_id: teacherId }
    const whereUnread = { teacher_id: teacherId, is_read: false }

    const notifications = await prisma.notifications.findMany({
      where: whereAll,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    })

    // Count queries are cheap — run them together in a single transaction (1 connection)
    const [total, unreadCount] = await prisma.$transaction([
      prisma.notifications.count({ where: whereAll }),
      prisma.notifications.count({ where: whereUnread }),
    ])

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        section: n.section,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
      total,
      unreadCount,
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(teacherId: string) {
    return prisma.notifications.count({
      where: { teacher_id: teacherId, is_read: false },
    })
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(teacherId: string, notificationId: string) {
    await prisma.notifications.updateMany({
      where: { id: notificationId, teacher_id: teacherId },
      data: { is_read: true },
    })
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(teacherId: string) {
    await prisma.notifications.updateMany({
      where: { teacher_id: teacherId, is_read: false },
      data: { is_read: true },
    })
  }
}
