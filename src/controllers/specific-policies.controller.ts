import { Response } from 'express'
import { AuthRequest } from '../types'
import { SpecificPoliciesService } from '../services/specific-policies.service'

export class SpecificPoliciesController {
  /**
   * GET /api/v1/teachers/specific-policies
   * Get the teacher's specific policies
   */
  static async getSpecificPolicies(req: AuthRequest, res: Response) {
    const policies = await SpecificPoliciesService.getSpecificPolicies(req.user!.id)

    res.json({
      success: true,
      data: policies,
    })
  }

  /**
   * PUT /api/v1/teachers/specific-policies
   * Save/update the teacher's specific policies
   */
  static async saveSpecificPolicies(req: AuthRequest, res: Response) {
    const {
      reschedule_limit,
      cancellation_limit,
      advance_notice_hours,
      noshow_threshold_mins,
      fee_structure,
      media_consent,
      terms_accepted,
    } = req.body

    const result = await SpecificPoliciesService.saveSpecificPolicies(req.user!.id, {
      reschedule_limit: reschedule_limit !== undefined ? reschedule_limit : null,
      cancellation_limit: cancellation_limit !== undefined ? cancellation_limit : null,
      advance_notice_hours: advance_notice_hours || 24,
      noshow_threshold_mins: noshow_threshold_mins || 10,
      fee_structure: fee_structure || [],
      media_consent: media_consent || false,
      terms_accepted: terms_accepted || false,
    })

    res.json({
      success: true,
      data: result,
      message: 'Specific policies saved successfully',
    })
  }

  /**
   * POST /api/v1/teachers/specific-policies/submit
   * Submit specific policies for admin review
   */
  static async submitForReview(req: AuthRequest, res: Response) {
    const result = await SpecificPoliciesService.submitForReview(req.user!.id)

    res.json({
      success: true,
      data: result,
      message: 'Specific policies submitted for review',
    })
  }

  /**
   * GET /api/v1/teachers/specific-policies/review-status
   * Get review status for specific policies
   */
  static async getReviewStatus(req: AuthRequest, res: Response) {
    const status = await SpecificPoliciesService.getReviewStatus(req.user!.id)

    res.json({
      success: true,
      data: status,
    })
  }

  /**
   * GET /api/v1/admin/teachers/:teacherId/specific-policies
   * Admin: view a teacher's specific policies
   */
  static async adminGetTeacherPolicies(req: AuthRequest, res: Response) {
    const { teacherId } = req.params

    const policies = await SpecificPoliciesService.getTeacherSpecificPolicies(teacherId)

    res.json({
      success: true,
      data: policies,
    })
  }
}
