import prisma from '../config/database'
import { AppError } from '../types'
import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation'

// Helper to reset profile status when major changes are made
async function resetProfileStatusIfApproved(teacherId: string) {
  const teacher = await prisma.teachers.findUnique({
    where: { id: teacherId },
    select: { profile_status: true },
  })

  // Reset to draft if profile was previously approved or pending review
  if (teacher && (teacher.profile_status === 'approved' || teacher.profile_status === 'pending_review')) {
    await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        profile_status: 'changes_requested',
        profile_review_notes: 'Profile was modified and requires re-review.',
      },
    })
    return true
  }
  return false
}

export class TeacherService {
  // Complete teacher onboarding
  static async onboard(teacherId: string, data: TeacherOnboardingInput) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher record not found', 'TEACHER_NOT_FOUND')
    }

    // Check if already onboarded
    if (teacher.bio) {
      throw new AppError(409, 'Teacher already onboarded', 'ALREADY_ONBOARDED')
    }

    // Update teacher with onboarding data
    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        bio: data.bio,
        experience_years: data.experience_years,
      },
    })

    return updated
  }

  // Get teacher profile
  static async getProfile(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: {
        profiles: true,
        class_packages: {
          where: { is_active: true },
        },
        teacher_languages: true,
        teacher_formats: true,
        teacher_engagements: true,
        teacher_instruments: {
          include: {
            teacher_instrument_tiers: true,
          },
        },
        reviews: {
          include: {
            students: {
              include: {
                profiles: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 10,
        },
      },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const normalize = (raw: any) => {
      if (!raw) return null
      const levels = ['beginner', 'intermediate', 'advanced'] as const
      const out: any = {}
      for (const level of levels) {
        const val = raw[level]
        if (!val) {
          out[level] = { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] }
        } else if (Array.isArray(val)) {
          out[level] = { '10': val, '20': val, '30': val }
        } else {
          out[level] = {
            '10': val['10'] || ['', '', '', ''],
            '20': val['20'] || ['', '', '', ''],
            '30': val['30'] || ['', '', '', ''],
          }
        }
      }
      return out
    }

    // Compute minimum student-facing starting price from all instruments and tiers
    let minPrice: number | null = null
    if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
      teacher.teacher_instruments.forEach((inst: any) => {
        if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
          inst.teacher_instrument_tiers.forEach((tier: any) => {
            const raw = tier.price_inr
            const teacherPrice = raw && typeof raw === 'object' && typeof raw.toNumber === 'function'
              ? raw.toNumber()
              : typeof raw === 'number'
                ? raw
                : null

            const rawMarkup = tier.platform_markup_inr
            const markup = rawMarkup && typeof rawMarkup === 'object' && typeof rawMarkup.toNumber === 'function'
              ? rawMarkup.toNumber()
              : typeof rawMarkup === 'number'
                ? rawMarkup
                : 0

            const studentPrice = teacherPrice !== null ? teacherPrice + markup : null

            if (studentPrice !== null && (minPrice === null || studentPrice < minPrice)) {
              minPrice = studentPrice
            }
          })
        }

        const rawBase = inst.base_price
        const basePrice = rawBase && typeof rawBase === 'object' && typeof rawBase.toNumber === 'function'
          ? rawBase.toNumber()
          : typeof rawBase === 'number'
            ? rawBase
            : null

        if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
          minPrice = basePrice
        }
      })
    }

    return {
      ...teacher,
      teacher_instruments: teacher.teacher_instruments?.map((inst: any) => ({
        ...inst,
        package_card_points: normalize(inst.package_card_points),
      })) || [],
      starting_price: minPrice,
    }
  }

  // Update teacher profile
  static async updateProfile(teacherId: string, data: TeacherProfileUpdateInput) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    // Prepare update data with all possible fields
    const updateData: any = {}
    
    // Old fields (for backwards compatibility)
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.experience_years !== undefined) updateData.experience_years = data.experience_years
    
    // New profile fields
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.date_of_birth !== undefined) updateData.date_of_birth = new Date(data.date_of_birth)
    if (data.current_city !== undefined) updateData.current_city = data.current_city
    if (data.pincode !== undefined) updateData.pincode = data.pincode
    if (data.music_experience_years !== undefined) updateData.music_experience_years = data.music_experience_years
    if (data.teaching_experience_years !== undefined) updateData.teaching_experience_years = data.teaching_experience_years
    if (data.performance_experience_years !== undefined) updateData.performance_experience_years = data.performance_experience_years
    if (data.tagline !== undefined) updateData.tagline = data.tagline
    if (data.education !== undefined) updateData.education = data.education
    if (data.youtube_links !== undefined) updateData.youtube_links = data.youtube_links
    if (data.demo !== undefined) updateData.demo = data.demo
    if (data.media_consent !== undefined) updateData.media_consent = data.media_consent
    if (data.profile_picture !== undefined) updateData.profile_picture = data.profile_picture
    if (data.teaching_style !== undefined) updateData.teaching_style = data.teaching_style
    if (data.professional_experience !== undefined) updateData.professional_experience = data.professional_experience

    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: updateData,
    })

    // Reset profile status if major profile fields changed
    const majorFields = ['bio', 'name', 'tagline', 'education', 'teaching_style', 'professional_experience', 'youtube_links']
    const hasMajorChange = majorFields.some(field => (data as any)[field] !== undefined)
    if (hasMajorChange) {
      await resetProfileStatusIfApproved(teacherId)
    }

    // Update languages if provided
    if (data.languages && data.languages.length > 0) {
      // Delete existing languages
      await prisma.teacher_languages.deleteMany({
        where: { teacher_id: teacherId },
      })
      
      // Insert new languages
      await prisma.teacher_languages.createMany({
        data: data.languages.map(language => ({
          teacher_id: teacherId,
          language,
        })),
      })
    }

    return updated
  }

  // Get all teachers (public)
  static async getAllTeachers(filters?: {
    verified?: boolean
    limit?: number
    offset?: number
  }) {
    const teachers = await prisma.teachers.findMany({
      where: {
        verified: filters?.verified,
      },
      include: {
        profiles: true,
        class_packages: {
          where: { is_active: true },
        },
        teacher_languages: true,
        teacher_formats: true,
        teacher_instruments: {
          include: {
            teacher_instrument_tiers: true,
          },
        },
      },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
      orderBy: {
        created_at: 'desc',
      },
    })

    const teachersWithStartingPrice = teachers.map((teacher: any) => {
      let minPrice: number | null = null

      if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
        teacher.teacher_instruments.forEach((inst: any) => {
          if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
            inst.teacher_instrument_tiers.forEach((tier: any) => {
              const raw = tier.price_inr
              const teacherPrice = raw && typeof raw === 'object' && typeof raw.toNumber === 'function'
                ? raw.toNumber()
                : typeof raw === 'number'
                  ? raw
                  : null

              const rawMarkup = tier.platform_markup_inr
              const markup = rawMarkup && typeof rawMarkup === 'object' && typeof rawMarkup.toNumber === 'function'
                ? rawMarkup.toNumber()
                : typeof rawMarkup === 'number'
                  ? rawMarkup
                  : 0

              const studentPrice = teacherPrice !== null ? teacherPrice + markup : null

              if (studentPrice !== null && (minPrice === null || studentPrice < minPrice)) {
                minPrice = studentPrice
              }
            })
          }

          const rawBase = inst.base_price
          const basePrice = rawBase && typeof rawBase === 'object' && typeof rawBase.toNumber === 'function'
            ? rawBase.toNumber()
            : typeof rawBase === 'number'
              ? rawBase
              : null

          if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
            minPrice = basePrice
          }
        })
      }

      const normalize = (raw: any) => {
        if (!raw) return null
        const levels = ['beginner', 'intermediate', 'advanced'] as const
        const out: any = {}
        for (const level of levels) {
          const val = raw[level]
          if (!val) {
            out[level] = { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] }
          } else if (Array.isArray(val)) {
            out[level] = { '10': val, '20': val, '30': val }
          } else {
            out[level] = {
              '10': val['10'] || ['', '', '', ''],
              '20': val['20'] || ['', '', '', ''],
              '30': val['30'] || ['', '', '', ''],
            }
          }
        }
        return out
      }

      return {
        ...teacher,
        teacher_instruments: teacher.teacher_instruments?.map((inst: any) => ({
          ...inst,
          package_card_points: normalize(inst.package_card_points),
        })) || [],
      }
    })

    return teachersWithStartingPrice
  }

  // Get teacher bank details
  static async getBankDetails(teacherId: string) {
    const bankDetails = await prisma.teacher_bank_details.findUnique({
      where: { teacher_id: teacherId },
    })

    return bankDetails
  }

  // Save/update teacher bank details
  static async saveBankDetails(teacherId: string, data: {
    bank_name: string
    account_holder_name: string
    account_number: string
    gst_number: string | null
    ifsc_code: string | null
  }) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    // Upsert bank details
    const bankDetails = await prisma.teacher_bank_details.upsert({
      where: { teacher_id: teacherId },
      update: {
        bank_name: data.bank_name,
        account_holder_name: data.account_holder_name,
        account_number: data.account_number,
        gst_number: data.gst_number,
        ifsc_code: data.ifsc_code,
        updated_at: new Date(),
      },
      create: {
        teacher_id: teacherId,
        bank_name: data.bank_name,
        account_holder_name: data.account_holder_name,
        account_number: data.account_number,
        gst_number: data.gst_number,
        ifsc_code: data.ifsc_code,
      },
    })

    return bankDetails
  }

  // Get teacher instruments with tiers
  static async getInstruments(teacherId: string) {
    const instruments = await prisma.teacher_instruments.findMany({
      where: { teacher_id: teacherId },
      include: {
        teacher_instrument_tiers: true,
      },
      orderBy: { created_at: 'asc' },
    })

    return instruments
  }

  // Create a new instrument with tiers
  static async createInstrument(teacherId: string, data: {
    instrument: string
    teach_or_perform: string
    class_mode?: string
    base_price?: number
    performance_fee_inr?: number
    open_to_international?: boolean
    international_premium?: number
    tiers?: Array<{
      level: string
      mode: string
      price_inr: number
    }>
  }) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    // Create instrument
    console.log('[TeacherService.createInstrument] Input data:', { instrument: data.instrument, teach_or_perform: data.teach_or_perform });
    console.log('[TeacherService.createInstrument] Normalized teach_or_perform:', data.teach_or_perform.toLowerCase());
    const instrument = await prisma.teacher_instruments.create({
      data: {
        teacher_id: teacherId,
        instrument: data.instrument,
        teach_or_perform: data.teach_or_perform.toLowerCase(),
        class_mode: data.class_mode as any,
        base_price: data.base_price,
        performance_fee_inr: data.performance_fee_inr,
      },
    })

    // Create tiers if provided
    if (data.tiers && data.tiers.length > 0) {
      await prisma.teacher_instrument_tiers.createMany({
        data: data.tiers.map(tier => ({
          teacher_instrument_id: instrument.id,
          level: tier.level as any,
          mode: tier.mode as any,
          price_inr: tier.price_inr,
          price_foreign: data.open_to_international && data.international_premium 
            ? tier.price_inr * (1 + data.international_premium / 100) 
            : null,
        })),
      })
    }

    // Reset profile status since instruments changed
    await resetProfileStatusIfApproved(teacherId)

    // Fetch and return with tiers
    const result = await prisma.teacher_instruments.findUnique({
      where: { id: instrument.id },
      include: { teacher_instrument_tiers: true },
    })

    return result
  }

  // Update an instrument and its tiers
  static async updateInstrument(teacherId: string, instrumentId: string, data: {
    instrument?: string
    teach_or_perform?: string
    class_mode?: string
    base_price?: number
    performance_fee_inr?: number
    open_to_international?: boolean
    international_premium?: number
    tiers?: Array<{
      level: string
      mode: string
      price_inr: number
    }>
  }) {
    // Check if instrument exists and belongs to teacher
    const existing = await prisma.teacher_instruments.findFirst({
      where: { id: instrumentId, teacher_id: teacherId },
    })

    if (!existing) {
      throw new AppError(404, 'Instrument not found', 'INSTRUMENT_NOT_FOUND')
    }

    // Update instrument
    console.log('[TeacherService.updateInstrument] Input data:', { teach_or_perform: data.teach_or_perform });
    const updateData: any = { updated_at: new Date() }
    if (data.instrument !== undefined) updateData.instrument = data.instrument
    if (data.teach_or_perform !== undefined) updateData.teach_or_perform = data.teach_or_perform.toLowerCase()
    if (data.class_mode !== undefined) updateData.class_mode = data.class_mode
    if (data.base_price !== undefined) updateData.base_price = data.base_price
    if (data.performance_fee_inr !== undefined) updateData.performance_fee_inr = data.performance_fee_inr

    await prisma.teacher_instruments.update({
      where: { id: instrumentId },
      data: updateData,
    })

    // Update tiers if provided
    if (data.tiers) {
      // Delete existing tiers
      await prisma.teacher_instrument_tiers.deleteMany({
        where: { teacher_instrument_id: instrumentId },
      })

      // Create new tiers
      if (data.tiers.length > 0) {
        await prisma.teacher_instrument_tiers.createMany({
          data: data.tiers.map(tier => ({
            teacher_instrument_id: instrumentId,
            level: tier.level as any,
            mode: tier.mode as any,
            price_inr: tier.price_inr,
            price_foreign: data.open_to_international && data.international_premium
              ? tier.price_inr * (1 + data.international_premium / 100)
              : null,
          })),
        })
      }
    }

    // Reset profile status since instruments changed
    await resetProfileStatusIfApproved(teacherId)

    // Fetch and return with tiers
    const result = await prisma.teacher_instruments.findUnique({
      where: { id: instrumentId },
      include: { teacher_instrument_tiers: true },
    })

    return result
  }

  // Delete an instrument
  static async deleteInstrument(teacherId: string, instrumentId: string) {
    // Check if instrument exists and belongs to teacher
    const existing = await prisma.teacher_instruments.findFirst({
      where: { id: instrumentId, teacher_id: teacherId },
    })

    if (!existing) {
      throw new AppError(404, 'Instrument not found', 'INSTRUMENT_NOT_FOUND')
    }

    // Delete (cascade will remove tiers)
    await prisma.teacher_instruments.delete({
      where: { id: instrumentId },
    })

    // Reset profile status since instruments changed
    await resetProfileStatusIfApproved(teacherId)

    return { deleted: true }
  }

  // Get profile completion status - what's filled and what's missing
  static async getProfileCompletionStatus(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: {
        profiles: true,
        teacher_instruments: {
          include: {
            teacher_instrument_tiers: true,
          },
        },
        teacher_bank_details: true,
        teacher_availability: true,
        teacher_languages: true,
      },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    // Define profile sections and their completion status
    const sections = {
      bio: {
        label: 'Introduce yourself',
        description: 'Add your bio, experience, and teaching background',
        completed: !!(teacher.bio && teacher.bio.trim().length > 0),
        link: '/dashboard/profile',
      },
      pricing: {
        label: 'Define your pricing',
        description: 'Add instruments, class formats, and hourly fees',
        completed: teacher.teacher_instruments.length > 0 && 
          teacher.teacher_instruments.some(inst => 
            inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0
          ),
        link: '/dashboard/pricing',
      },
      availability: {
        label: 'Choose your hours',
        description: 'Set when students can book sessions with you',
        completed: teacher.teacher_availability && teacher.teacher_availability.length > 0,
        link: '/dashboard/calendar',
      },
      bank_details: {
        label: 'Arrange earnings',
        description: 'Add payout details to receive payments',
        completed: !!(teacher.teacher_bank_details && 
          teacher.teacher_bank_details.bank_name && 
          teacher.teacher_bank_details.account_number),
        link: '/dashboard/earnings',
      },
    }

    // Calculate overall completion percentage
    const totalSections = Object.keys(sections).length
    const completedSections = Object.values(sections).filter(s => s.completed).length
    const completionPercentage = Math.round((completedSections / totalSections) * 100)

    // Check if all required sections are complete for review submission
    const canSubmitForReview = completionPercentage === 100

    return {
      sections,
      completionPercentage,
      canSubmitForReview,
      profileStatus: teacher.profile_status,
      profileSubmittedAt: teacher.profile_submitted_at,
      profileReviewedAt: teacher.profile_reviewed_at,
      profileReviewNotes: teacher.profile_review_notes,
    }
  }

  // Submit profile for review
  static async submitProfileForReview(teacherId: string) {
    // First check completion status
    const status = await this.getProfileCompletionStatus(teacherId)

    if (!status.canSubmitForReview) {
      throw new AppError(400, 'Please complete all required profile sections before submitting for review', 'PROFILE_INCOMPLETE')
    }

    if (status.profileStatus === 'pending_review') {
      throw new AppError(400, 'Your profile is already pending review', 'ALREADY_PENDING')
    }

    if (status.profileStatus === 'approved') {
      throw new AppError(400, 'Your profile is already approved', 'ALREADY_APPROVED')
    }

    // Update profile status
    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        profile_status: 'pending_review',
        profile_submitted_at: new Date(),
        profile_review_notes: null,
      },
    })

    return {
      success: true,
      message: 'Profile submitted for review successfully',
      profileStatus: updated.profile_status,
      submittedAt: updated.profile_submitted_at,
    }
  }
}
