import { Response } from 'express'
import { AuthRequest } from '../types'
import { SectionReviewService } from '../services/section-review.service'

export class SectionReviewController {
  // GET /api/v1/teachers/section-reviews
  static async getAllStatuses(req: AuthRequest, res: Response) {
    const statuses = await SectionReviewService.getAllSectionStatuses(req.user!.id)

    res.json({
      success: true,
      data: statuses,
    })
  }

  // GET /api/v1/teachers/section-reviews/:section
  static async getSectionStatus(req: AuthRequest, res: Response) {
    const { section } = req.params

    if (section !== 'profile' && section !== 'pricing' && section !== 'specific_policies') {
      res.status(400).json({ success: false, error: 'Invalid section. Must be profile, pricing, or specific_policies' })
      return
    }

    const status = await SectionReviewService.getSectionReviewStatus(req.user!.id, section)

    res.json({
      success: true,
      data: status,
    })
  }

  // POST /api/v1/teachers/section-reviews/:section/submit
  static async submitForReview(req: AuthRequest, res: Response) {
    const { section } = req.params

    if (section !== 'profile' && section !== 'pricing' && section !== 'specific_policies') {
      res.status(400).json({ success: false, error: 'Invalid section. Must be profile, pricing, or specific_policies' })
      return
    }

    const result = await SectionReviewService.submitSectionForReview(req.user!.id, section)

    res.json({
      success: true,
      data: result,
      message: `${section} submitted for review`,
    })
  }

  // ---- Admin endpoints ----

  // GET /api/v1/admin/section-reviews/pending
  static async getPendingReviews(_req: AuthRequest, res: Response) {
    const reviews = await SectionReviewService.getPendingSectionReviews()

    res.json({
      success: true,
      data: reviews,
    })
  }

  // POST /api/v1/admin/section-reviews/:reviewId/action
  static async reviewSection(req: AuthRequest, res: Response) {
    const { reviewId } = req.params
    const { action, comment } = req.body

    if (!action || !['approve', 'reject', 'request_changes'].includes(action)) {
      res.status(400).json({
        success: false,
        error: 'Invalid action. Must be one of: approve, reject, request_changes',
      })
      return
    }

    const result = await SectionReviewService.reviewSection(req.user!.id, reviewId, action, comment)

    res.json({
      success: true,
      data: result,
      message: `Section ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes requested'} successfully`,
    })
  }
}
