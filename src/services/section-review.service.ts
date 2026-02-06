import prisma from '../config/database'
import { AppError } from '../types'

type SectionType = 'profile' | 'pricing' | 'specific_policies'

export class SectionReviewService {
  /**
   * Get review status for a specific section
   */
  static async getSectionReviewStatus(teacherId: string, section: SectionType) {
    const review = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section,
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
          section,
          status: 'draft' as const,
          submittedAt: null,
          reviewedAt: null,
          notes: null,
        }
  }

  /**
   * Get all section review statuses for a teacher
   */
  static async getAllSectionStatuses(teacherId: string) {
    const reviews = await prisma.teacher_section_reviews.findMany({
      where: { teacher_id: teacherId },
    })

    const statusMap: Record<string, any> = {}
    for (const r of reviews) {
      statusMap[r.section] = {
        status: r.status,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
        notes: r.notes,
      }
    }

    // Default all sections to draft if no record exists
    for (const section of ['profile', 'pricing', 'specific_policies'] as SectionType[]) {
      if (!statusMap[section]) {
        statusMap[section] = {
          status: 'draft',
          submittedAt: null,
          reviewedAt: null,
          notes: null,
        }
      }
    }

    return statusMap
  }

  /**
   * Submit a section for review
   */
  static async submitSectionForReview(teacherId: string, section: SectionType) {
    // Check if section already pending
    const existing = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section,
        },
      },
    })

    if (existing?.status === 'pending_review') {
      throw new AppError(400, `${section} is already pending review`, 'ALREADY_PENDING')
    }

    const review = await prisma.teacher_section_reviews.upsert({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section,
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
        section,
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
   * Void (reset) a section's approval when changes are made
   */
  static async voidSectionApproval(teacherId: string, section: SectionType) {
    const existing = await prisma.teacher_section_reviews.findUnique({
      where: {
        teacher_id_section: {
          teacher_id: teacherId,
          section,
        },
      },
    })

    // Only void if currently approved or pending
    if (existing && (existing.status === 'approved' || existing.status === 'pending_review')) {
      await prisma.teacher_section_reviews.update({
        where: { id: existing.id },
        data: {
          status: 'changes_requested',
          notes: 'Your changes voided the previous approval. Please re-submit for review.',
          updated_at: new Date(),
        },
      })

      // Create a notification for the teacher
      await prisma.notifications.create({
        data: {
          teacher_id: teacherId,
          title: `${section === 'profile' ? 'Profile' : 'Pricing'} approval voided`,
          message: `Your ${section} was modified after approval. Please re-submit it for review.`,
          type: 'warning',
          section,
        },
      })

      return true
    }
    return false
  }

  /**
   * Admin: get all sections pending review across all teachers
   */
  static async getPendingSectionReviews() {
    const reviews = await prisma.teacher_section_reviews.findMany({
      where: { status: 'pending_review' },
      include: {
        teachers: {
          include: {
            profiles: {
              include: { users: true },
            },
          },
        },
      },
      orderBy: { submitted_at: 'asc' },
    })

    return reviews.map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teachers.name || r.teachers.profiles?.name || 'Unknown',
      teacherEmail: (r.teachers.profiles as any)?.users?.email || '',
      profilePicture: r.teachers.profile_picture,
      section: r.section,
      submittedAt: r.submitted_at,
    }))
  }

  /**
   * Admin: review a section (approve / reject / request_changes) with optional comment
   */
  static async reviewSection(
    adminId: string,
    reviewId: string,
    action: 'approve' | 'reject' | 'request_changes',
    comment?: string
  ) {
    const review = await prisma.teacher_section_reviews.findUnique({
      where: { id: reviewId },
    })

    if (!review) {
      throw new AppError(404, 'Review not found', 'REVIEW_NOT_FOUND')
    }

    if (review.status !== 'pending_review') {
      throw new AppError(400, 'This section is not pending review', 'NOT_PENDING')
    }

    const statusMap = {
      approve: 'approved' as const,
      reject: 'rejected' as const,
      request_changes: 'changes_requested' as const,
    }

    const newStatus = statusMap[action]

    const updated = await prisma.teacher_section_reviews.update({
      where: { id: reviewId },
      data: {
        status: newStatus,
        reviewed_at: new Date(),
        reviewed_by: adminId,
        notes: comment || null,
        updated_at: new Date(),
      },
    })

    // If both profile and pricing are now approved, verify the teacher
    if (newStatus === 'approved') {
      const allReviews = await prisma.teacher_section_reviews.findMany({
        where: { teacher_id: review.teacher_id },
      })
      const allApproved =
        allReviews.length >= 2 && allReviews.every((r) => r.status === 'approved')

      if (allApproved) {
        await prisma.teachers.update({
          where: { id: review.teacher_id },
          data: { verified: true },
        })
      }
    }

    // Create notification for teacher
    const sectionLabel = review.section === 'profile' ? 'Profile' : review.section === 'pricing' ? 'Pricing' : 'Specific Policies'
    const titleMap = {
      approve: `${sectionLabel} approved`,
      reject: `${sectionLabel} rejected`,
      request_changes: `Changes requested for ${sectionLabel}`,
    }
    const messageMap = {
      approve: `Your ${review.section} has been approved by the admin.`,
      reject: `Your ${review.section} has been rejected.${comment ? ` Reason: ${comment}` : ''}`,
      request_changes: `The admin has requested changes to your ${review.section}.${comment ? ` Feedback: ${comment}` : ''}`,
    }

    await prisma.notifications.create({
      data: {
        teacher_id: review.teacher_id,
        title: titleMap[action],
        message: messageMap[action],
        type: action === 'approve' ? 'success' : action === 'reject' ? 'error' : 'warning',
        section: review.section,
      },
    })

    return {
      id: updated.id,
      section: updated.section,
      status: updated.status,
      reviewedAt: updated.reviewed_at,
      notes: updated.notes,
    }
  }
}
