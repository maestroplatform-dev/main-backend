import prisma from '../config/database'
import { AppError } from '../types'
import type { TeacherCompleteOnboardingInput } from '../utils/validation'
import { computeTotalPrice, buildPricingConfig } from '../utils/pricing'
import { ActivityNotificationService } from './activity-notification.service'

export class TeacherOnboardingService {
  private static buildOnboardingCallbackUrl(): string | null {
    if (process.env.N8N_ONBOARDING_CALLBACK_URL) return process.env.N8N_ONBOARDING_CALLBACK_URL
    if (process.env.API_BASE_URL) {
      return `${process.env.API_BASE_URL.replace(/\/$/, '')}/api/v1/teachers/onboarding/n8n-callback`
    }
    return null
  }

  private static async sendToN8n(payload: {
    teacherId: string
    inputType: 'resume' | 'text'
    resumeUrl?: string
    aboutText?: string
  }) {
    const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL
    if (!webhookUrl) {
      return { queued: false, reason: 'N8N_ONBOARDING_WEBHOOK_URL not configured' }
    }

    const callbackUrl = this.buildOnboardingCallbackUrl()

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_CALLBACK_SECRET ? { Authorization: `Bearer ${process.env.N8N_CALLBACK_SECRET}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        callbackUrl,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { queued: false, reason: `n8n rejected request (${response.status}): ${body}` }
    }

    return { queued: true }
  }

  // Complete onboarding 
  static async completeOnboarding(teacherId: string, data: TeacherCompleteOnboardingInput) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    try {
      const updatedTeacher = await prisma.$transaction(async (tx) => {
        // Update basic info on teacher
        const teacherRow = await tx.teachers.update({
          where: { id: teacherId },
          data: {
            phone: data.phone,
            date_of_birth: new Date(data.date_of_birth),
            music_experience_years: data.music_experience_years,
            teaching_experience_years: data.teaching_experience_years,
            performance_experience_years: data.performance_experience_years,
            current_city: data.current_city,
            pincode: data.pincode,
            media_consent: data.media_consent,
            profile_picture: data.profile_picture,
            demo: data.demo,
            tagline: data.tagline,
            bio: data.bio,
            teaching_style: data.teaching_style,
            education: data.education,
            professional_experience: data.professional_experience,
            youtube_links: data.youtube_links,
            engagement_type: data.engagement_type,
            starting_price_inr: data.starting_price_inr ?? null,
            open_to_international: data.open_to_international,
            international_premium: data.open_to_international ? data.international_premium : 0,
            // Admin-configurable pricing markup overrides
            custom_markup_pct_single: data.custom_markup_pct_single ?? null,
            custom_markup_pct_10: data.custom_markup_pct_10 ?? null,
            custom_markup_pct_20: data.custom_markup_pct_20 ?? null,
            custom_markup_pct_30: data.custom_markup_pct_30 ?? null,
            custom_rounding_single: data.custom_rounding_single ?? null,
            custom_rounding_10: data.custom_rounding_10 ?? null,
            custom_rounding_20: data.custom_rounding_20 ?? null,
            custom_rounding_30: data.custom_rounding_30 ?? null,
            onboarding_completed: true,
          },
        } as any)

        // Languages
        await (tx as any).teacher_languages.deleteMany({ where: { teacher_id: teacherId } })
        if (data.languages.length > 0) {
          await (tx as any).teacher_languages.createMany({
            data: data.languages.map((lang) => ({ teacher_id: teacherId, language: lang })),
          })
        }

        // Engagement preferences
        await (tx as any).teacher_engagements.upsert({
          where: { teacher_id: teacherId },
          create: {
            teacher_id: teacherId,
            engagement_type: data.engagement_type,
            collaborative_projects: data.collaborative_projects,
            collaborative_other: data.collaborative_other,
            performance_fee_per_hour: data.performance_fee_per_hour,
          },
          update: {
            engagement_type: data.engagement_type,
            collaborative_projects: data.collaborative_projects,
            collaborative_other: data.collaborative_other,
            performance_fee_per_hour: data.performance_fee_per_hour,
          },
        })

        // Teaching formats
        await (tx as any).teacher_formats.upsert({
          where: { teacher_id: teacherId },
          create: {
            teacher_id: teacherId,
            class_formats: data.class_formats,
            class_formats_other: data.class_formats_other,
            exam_training: data.exam_training,
            exam_training_other: data.exam_training_other,
            additional_formats: data.additional_formats,
            additional_formats_other: data.additional_formats_other,
            learner_groups: data.learner_groups,
            learner_groups_other: data.learner_groups_other,
            performance_settings: data.performance_settings,
            performance_settings_other: data.performance_settings_other,
            other_contribution: data.other_contribution,
          },
          update: {
            class_formats: data.class_formats,
            class_formats_other: data.class_formats_other,
            exam_training: data.exam_training,
            exam_training_other: data.exam_training_other,
            additional_formats: data.additional_formats,
            additional_formats_other: data.additional_formats_other,
            learner_groups: data.learner_groups,
            learner_groups_other: data.learner_groups_other,
            performance_settings: data.performance_settings,
            performance_settings_other: data.performance_settings_other,
            other_contribution: data.other_contribution,
          },
        })

        // Remove existing instruments and tiers
        const existingInstruments = await (tx as any).teacher_instruments.findMany({
          where: { teacher_id: teacherId },
          select: { id: true },
        })
        const existingIds = existingInstruments.map((i: any) => i.id)
        if (existingIds.length > 0) {
          await (tx as any).teacher_instrument_tiers.deleteMany({ where: { teacher_instrument_id: { in: existingIds } } })
        }
        await (tx as any).teacher_instruments.deleteMany({ where: { teacher_id: teacherId } })

        // Insert instruments and tiers
        console.log('[TeacherOnboardingService] Received instruments data:', JSON.stringify(data.instruments.map((i: any) => ({ instrument: i.instrument, teach_or_perform: i.teach_or_perform })), null, 2));
        for (const inst of data.instruments) {
          const normalizedType = inst.teach_or_perform.toLowerCase();
          console.log(`[TeacherOnboardingService] Processing instrument: ${inst.instrument}, Original: "${inst.teach_or_perform}", Normalized: "${normalizedType}"`);
          if (normalizedType === 'teach') {
            const teachInst = inst as any;
            const instrumentRow = await (tx as any).teacher_instruments.create({
              data: {
                teacher_id: teacherId,
                instrument: inst.instrument,
                teach_or_perform: normalizedType,
                class_mode: teachInst.class_mode,
                base_price: null,
                performance_fee_inr: null,
                performance_fee_foreign: null,
                package_card_points: inst.package_card_points || null,
              },
            })

            const tiers = (teachInst.tiers || []).map((tier: any) => {
              const priceForeign = data.open_to_international && data.international_premium
                ? tier.price_inr + data.international_premium
                : null
              return {
                teacher_instrument_id: instrumentRow.id,
                level: tier.level,
                mode: teachInst.class_mode,
                // Teacher's net price and optional platform markup
                price_inr: tier.price_inr,
                platform_markup_inr: tier.platform_markup_inr ?? null,
                price_foreign: priceForeign,
                // Level-specific one-on-one price
                one_on_one_price_inr: tier.one_on_one_price_inr ?? null,
              }
            })

            if (tiers.length > 0) {
              await (tx as any).teacher_instrument_tiers.createMany({ data: tiers })
            }
          } else {
            const performInst = inst as any;
            await (tx as any).teacher_instruments.create({
              data: {
                teacher_id: teacherId,
                instrument: inst.instrument,
                teach_or_perform: normalizedType,
                class_mode: null,
                base_price: null,
                // Teacher performance fee and optional platform markup
                performance_fee_inr: performInst.performance_fee_inr,
                performance_platform_markup_inr: performInst.platform_markup_inr ?? null,
                performance_fee_foreign:
                  data.open_to_international && data.international_premium
                    ? performInst.performance_fee_inr + data.international_premium
                    : null,
                // Removed open_to_international and international_premium
                package_card_points: inst.package_card_points || null,
              },
            })
          }
        }

        // Auto-create default packages if not already present
        const existingPackages = await (tx as any).class_packages.findMany({
          where: { teacher_id: teacherId }
        })

        if (existingPackages.length === 0) {
          // Get beginner tier price from first teaching instrument
          const firstTeachingInstrument = data.instruments.find(i => i.teach_or_perform.toLowerCase() === 'teach') as any
          if (firstTeachingInstrument && firstTeachingInstrument.tiers && firstTeachingInstrument.tiers.length > 0) {
            const beginnerTier = firstTeachingInstrument.tiers.find((t: any) => t.level === 'beginner')
            if (beginnerTier && beginnerTier.price_inr) {
              const basePrice = beginnerTier.price_inr

              // Build pricing config from teacher's custom markup overrides
              const pricingConfig = buildPricingConfig({
                custom_markup_pct_single: data.custom_markup_pct_single,
                custom_markup_pct_10: data.custom_markup_pct_10,
                custom_markup_pct_20: data.custom_markup_pct_20,
                custom_markup_pct_30: data.custom_markup_pct_30,
                custom_rounding_single: data.custom_rounding_single,
                custom_rounding_10: data.custom_rounding_10,
                custom_rounding_20: data.custom_rounding_20,
                custom_rounding_30: data.custom_rounding_30,
              })

              // Create 3 standard packages with marked-up prices
              const packagesToCreate = [
                {
                  teacher_id: teacherId,
                  name: '10 Sessions Package',
                  description: 'Perfect for beginners to get started',
                  classes_count: 10,
                  validity_days: 90,
                  price: computeTotalPrice(basePrice, 10, pricingConfig ?? undefined),
                  is_active: true
                },
                {
                  teacher_id: teacherId,
                  name: '20 Sessions Package',
                  description: 'Most popular choice for consistent learning',
                  classes_count: 20,
                  validity_days: 120,
                  price: computeTotalPrice(basePrice, 20, pricingConfig ?? undefined),
                  is_active: true
                },
                {
                  teacher_id: teacherId,
                  name: '30 Sessions Package',
                  description: 'Best value for committed learners',
                  classes_count: 30,
                  validity_days: 180,
                  price: computeTotalPrice(basePrice, 30, pricingConfig ?? undefined),
                  is_active: true
                }
              ]

              await (tx as any).class_packages.createMany({ data: packagesToCreate })
            }
          }
        }

        return teacherRow
      })

      return updatedTeacher
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(500, 'Failed to complete onboarding', 'ONBOARDING_FAILED')
    }
  }

  /**
   * Send teacher welcome email after onboarding completes
   */
  static async sendWelcomeEmail(teacherId: string) {
    try {
      const teacher = await prisma.teachers.findUnique({
        where: { id: teacherId },
        select: { name: true, profiles: { select: { users: { select: { email: true } } } } },
      })
      if (teacher?.profiles?.users?.email) {
        void ActivityNotificationService.notifyTeacherSignup(
          teacherId,
          teacher.name || 'Teacher',
          teacher.profiles.users.email
        ).catch(() => {})
      }
    } catch {
      // Silently fail — welcome email is non-critical
    }
  }

  // Get full onboarding data
  static async getOnboardingData(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    // Fetch related data separately
    const languages = await (prisma as any).teacher_languages.findMany({
      where: { teacher_id: teacherId },
    })

    const engagements = await (prisma as any).teacher_engagements.findUnique({
      where: { teacher_id: teacherId },
    })

    const formats = await (prisma as any).teacher_formats.findUnique({
      where: { teacher_id: teacherId },
    })

    const instruments = await (prisma as any).teacher_instruments.findMany({
      where: { teacher_id: teacherId },
      include: {
        teacher_instrument_tiers: true,
      },
    })

    const normalize = (raw: any) => {
      if (!raw) return null
      const levels = ['beginner', 'intermediate', 'advanced'] as const
      const sessions = ['10', '20', '30'] as const
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

    const normalizedInstruments = instruments.map((inst: any) => ({
      ...inst,
      package_card_points: normalize(inst.package_card_points),
    }))

    return {
      ...teacher,
      teacher_languages: languages,
      teacher_engagements: engagements,
      teacher_formats: formats,
      teacher_instruments: normalizedInstruments,
    }
  }

  static async processBackground(
    teacherId: string,
    data: {
      inputType: 'resume' | 'text'
      resumeUrl?: string
      aboutText?: string
    }
  ) {
    const teacher = await prisma.teachers.findUnique({ where: { id: teacherId } })
    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const seedText = data.inputType === 'resume'
      ? `Resume submitted: ${data.resumeUrl || ''}`
      : (data.aboutText || '').trim()

    await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        professional_experience: seedText || teacher.professional_experience || null,
        bio: data.inputType === 'text'
          ? seedText || teacher.bio || null
          : teacher.bio,
      },
    })

    const n8nResult = await this.sendToN8n({
      teacherId,
      inputType: data.inputType,
      resumeUrl: data.resumeUrl,
      aboutText: data.aboutText,
    })

    return {
      accepted: true,
      n8n: n8nResult,
    }
  }

  static async applyN8nProfileExtraction(data: {
    teacherId: string
    aboutMe?: string
    tagline?: string
    teachingStyle?: string
    educationalBackground?: string
    professionalExperience?: string
  }) {
    const teacher = await prisma.teachers.findUnique({ where: { id: data.teacherId } })
    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const updated = await prisma.teachers.update({
      where: { id: data.teacherId },
      data: {
        bio: data.aboutMe ?? teacher.bio,
        tagline: data.tagline ?? teacher.tagline,
        teaching_style: data.teachingStyle ?? teacher.teaching_style,
        education: data.educationalBackground ?? teacher.education,
        professional_experience: data.professionalExperience ?? teacher.professional_experience,
      },
      select: {
        id: true,
        bio: true,
        tagline: true,
        teaching_style: true,
        education: true,
        professional_experience: true,
      },
    })

    return {
      updated: true,
      teacher: updated,
    }
  }

  // Save engagement preferences only (simplified onboarding)
  static async saveEngagementPreferences(teacherId: string, data: {
    engagement_type: 'Teaching' | 'Performance' | 'Both'
    collaborative_projects: string[]
    collaborative_other?: string
    class_formats?: string[]
    class_formats_other?: string
    exam_training?: string[]
    exam_training_other?: string
    additional_formats?: string[]
    additional_formats_other?: string
    learner_groups?: string[]
    learner_groups_other?: string
    performance_settings?: string[]
    performance_settings_other?: string
    performance_fee_per_hour?: number
    other_contribution?: string
  }) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Update engagement type on teacher
        await tx.teachers.update({
          where: { id: teacherId },
          data: {
            engagement_type: data.engagement_type,
            onboarding_completed: true,
          },
        })

        // Engagement preferences
        await (tx as any).teacher_engagements.upsert({
          where: { teacher_id: teacherId },
          create: {
            teacher_id: teacherId,
            engagement_type: data.engagement_type,
            collaborative_projects: data.collaborative_projects || [],
            collaborative_other: data.collaborative_other || '',
            performance_fee_per_hour: data.performance_fee_per_hour || 0,
          },
          update: {
            engagement_type: data.engagement_type,
            collaborative_projects: data.collaborative_projects || [],
            collaborative_other: data.collaborative_other || '',
            performance_fee_per_hour: data.performance_fee_per_hour || 0,
          },
        })

        // Teaching formats (if provided)
        await (tx as any).teacher_formats.upsert({
          where: { teacher_id: teacherId },
          create: {
            teacher_id: teacherId,
            class_formats: data.class_formats || [],
            class_formats_other: data.class_formats_other || '',
            exam_training: data.exam_training || [],
            exam_training_other: data.exam_training_other || '',
            additional_formats: data.additional_formats || [],
            additional_formats_other: data.additional_formats_other || '',
            learner_groups: data.learner_groups || [],
            learner_groups_other: data.learner_groups_other || '',
            performance_settings: data.performance_settings || [],
            performance_settings_other: data.performance_settings_other || '',
            other_contribution: data.other_contribution || '',
          },
          update: {
            class_formats: data.class_formats || [],
            class_formats_other: data.class_formats_other || '',
            exam_training: data.exam_training || [],
            exam_training_other: data.exam_training_other || '',
            additional_formats: data.additional_formats || [],
            additional_formats_other: data.additional_formats_other || '',
            learner_groups: data.learner_groups || [],
            learner_groups_other: data.learner_groups_other || '',
            performance_settings: data.performance_settings || [],
            performance_settings_other: data.performance_settings_other || '',
            other_contribution: data.other_contribution || '',
          },
        })
      })

      return {
        success: true,
        message: 'Engagement preferences saved successfully',
      }
    } catch (error: any) {
      console.error('Error saving engagement preferences:', error)
      throw new AppError(500, 'Failed to save engagement preferences', 'SAVE_FAILED')
    }
  }

  // Get engagement preferences
  static async getEngagementPreferences(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      select: { engagement_type: true },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const engagements = await (prisma as any).teacher_engagements.findUnique({
      where: { teacher_id: teacherId },
    })

    const formats = await (prisma as any).teacher_formats.findUnique({
      where: { teacher_id: teacherId },
    })

    return {
      engagement_type: teacher.engagement_type || engagements?.engagement_type || null,
      collaborative_projects: engagements?.collaborative_projects || [],
      collaborative_other: engagements?.collaborative_other || '',
      performance_fee_per_hour: engagements?.performance_fee_per_hour || 0,
      class_formats: formats?.class_formats || [],
      class_formats_other: formats?.class_formats_other || '',
      exam_training: formats?.exam_training || [],
      exam_training_other: formats?.exam_training_other || '',
      additional_formats: formats?.additional_formats || [],
      additional_formats_other: formats?.additional_formats_other || '',
      learner_groups: formats?.learner_groups || [],
      learner_groups_other: formats?.learner_groups_other || '',
      performance_settings: formats?.performance_settings || [],
      performance_settings_other: formats?.performance_settings_other || '',
      other_contribution: formats?.other_contribution || '',
    }
  }
}
