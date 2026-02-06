import { Response } from 'express'
import { AuthRequest } from '../types'
import { NotificationService } from '../services/notification.service'

export class NotificationController {
  // GET /api/v1/teachers/notifications
  static async getNotifications(req: AuthRequest, res: Response) {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const result = await NotificationService.getNotifications(req.user!.id, limit, offset)

    res.json({
      success: true,
      data: result,
    })
  }

  // GET /api/v1/teachers/notifications/unread-count
  static async getUnreadCount(req: AuthRequest, res: Response) {
    const count = await NotificationService.getUnreadCount(req.user!.id)

    res.json({
      success: true,
      data: { unreadCount: count },
    })
  }

  // PATCH /api/v1/teachers/notifications/:id/read
  static async markAsRead(req: AuthRequest, res: Response) {
    await NotificationService.markAsRead(req.user!.id, req.params.id)

    res.json({
      success: true,
      message: 'Notification marked as read',
    })
  }

  // PATCH /api/v1/teachers/notifications/read-all
  static async markAllAsRead(req: AuthRequest, res: Response) {
    await NotificationService.markAllAsRead(req.user!.id)

    res.json({
      success: true,
      message: 'All notifications marked as read',
    })
  }
}
