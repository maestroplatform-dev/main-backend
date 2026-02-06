import prisma from '../config/database'
import { AppError } from '../types'

export interface SpecificPoliciesInput {
  reschedule_limit: number | null
  cancellation_limit: number | null
  advance_notice_hours: number
  noshow_threshold_mins: number
  fee_structure: any[]
  media_consent: boolean
  terms_accepted: boolean
}

export class SpecificPoliciesService {
  /**
   * Get a teacher's specific policies
   */
  static async getSpecificPolicies(teacherId: string) {
    const policies = await prisma.teacher_specific_policies.findUnique({
      where: { teacher_id: teacherId },
    })

    if (!policies) {
      return {
        reschedule_limit: null,
        cancellation_limit: null,
        advance_notice_hours: 24,
        noshow_threshold_mins: 10,
        fee_structure: [],
        media_consent: false,
        terms_accepted: false,
      }
    }

    return {
      reschedule_limit: policies.reschedule_limit,
      cancellation_limit: policies.cancellation_limit,
      advance_notice_hours: policies.advance_notice_hours,
      noshow_threshold_mins: policies.noshow_threshold_mins,
      fee_structure: (policies.fee_structure as any[]) || [],
      media_consent: policies.media_consent,
      terms_accepted: policies.terms_accepted,
    }
  }

  /**
   * Save/update a teacher's specific policies
   */
  static async saveSpecificPolicies(teacherId: string, data: SpecificPoliciesInput) {
    const policies = await prisma.teacher_specific_policies.upsert({
      where: { teacher_id: teacherId },
      update: {
        reschedule_limit: data.reschedule_limit,
        cancellation_limit: data.cancellation_limit,
        advance_notice_hours: data.advance_notice_hours,
        noshow_threshold_mins: data.noshow_threshold_mins,
        fee_structure: data.fee_structure as any,
        media_consent: data.media_consent,
        terms_accepted: data.terms_accepted,
        updated_at: new Date(),
      },
      create: {
        teacher_id: teacherId,
        reschedule_limit: data.reschedule_limit,
        cancellation_limit: data.cancellation_limit,
        advance_notice_hours: data.advance_notice_hours,
        noshow_threshold_mins: data.noshow_threshold_mins,
        fee_structure: data.fee_structure as any,
        media_consent: data.media_consent,
        terms_accepted: data.terms_accepted,
      },
    })

    // Void previous approval for specific_policies section when data changes
    await this.voidSpecificPoliciesApproval(teacherId)

    return {
      reschedule_limit: policies.reschedule_limit,
      cancellation_limit: policies.cancellation_limit,
      advance_notice_hours: policies.advance_notice_hours,
      noshow_threshold_mins: policies.noshow_threshold_mins,
      fee_structure: (policies.fee_structure as any[]) || [],
      media_consent: policies.media_consent,
      terms_accepted: policies.terms_accepted,
    }
  }

  /**
   * Submit specific policies for admin review
   */
  static async submitForReview(teacherId: string) {
    // Check if already pending
    const existing = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section: 'specific_policies',
        },
      },
    })

    if (existing?.status === 'pending_review') {
      throw new AppError(400, 'Specific policies are already pending review', 'ALREADY_PENDING')
    }

    const review = await prisma.teacher_section_reviews.upsert({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section: 'specific_policies',
        },
      },
      update: {
        status: 'pending_review',
        submitted_at: new Date(),
        notes: null,
        updated_at: new Date(),
      },
      create: {
        teacher_id: teacherId,
        section: 'specific_policies',
        status: 'pending_review',
        submitted_at: new Date(),
      },
    })

    return {
      section: review.section,
      status: review.status,
      submittedAt: review.submitted_at,
    }
  }

  /**
   * Get review status for specific policies
   */
  static async getReviewStatus(teacherId: string) {
    const review = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section: 'specific_policies',
        },
      },
    })

    return review
      ? {
          section: review.section,
          status: review.status,
          submittedAt: review.submitted_at,
          reviewedAt: review.reviewed_at,
          notes: review.notes,
        }
      : {
          section: 'specific_policies',
          status: 'draft' as const,
          submittedAt: null,
          reviewedAt: null,
          notes: null,
        }
  }

  /**
   * Void approval when teacher edits their specific policies
   */
  private static async voidSpecificPoliciesApproval(teacherId: string) {
    const existing = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section: 'specific_policies',
        },
      },
    })

    if (existing && (existing.status === 'approved' || existing.status === 'pending_review')) {
      await prisma.teacher_section_reviews.update({
        where: { id: existing.id },
        data: {
          status: 'changes_requested',
          notes: 'Your changes voided the previous approval. Please re-submit for review.',
          updated_at: new Date(),
        },
      })

      await prisma.notifications.create({
        data: {
          teacher_id: teacherId,
          title: 'Specific Policies approval voided',
          message:
            'Your specific policies were modified after approval. Please re-submit for review.',
          type: 'warning',
          section: 'specific_policies',
        },
      })
    }
  }

  /**
   * Admin: get specific policies data for a teacher
   */
  static async getTeacherSpecificPolicies(teacherId: string) {
    const policies = await prisma.teacher_specific_policies.findUnique({
      where: { teacher_id: teacherId },
    })

    return policies
      ? {
          reschedule_limit: policies.reschedule_limit,
          cancellation_limit: policies.cancellation_limit,
          advance_notice_hours: policies.advance_notice_hours,
          noshow_threshold_mins: policies.noshow_threshold_mins,
          fee_structure: (policies.fee_structure as any[]) || [],
          media_consent: policies.media_consent,
          terms_accepted: policies.terms_accepted,
        }
      : null
  }
}
