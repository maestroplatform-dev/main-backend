import prisma from '../config/database'
import { AppError } from '../types'
import type { TeacherCompleteOnboardingInput } from '../utils/validation'

export class TeacherOnboardingService {
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
            demo_session_available: data.demo_session_available,
            media_consent: data.media_consent,
            engagement_type: data.engagement_type,
            open_to_international: data.open_to_international,
            international_premium: data.open_to_international ? data.international_premium : 0,
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
          },
          update: {
            engagement_type: data.engagement_type,
            collaborative_projects: data.collaborative_projects,
            collaborative_other: data.collaborative_other,
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
        for (const inst of data.instruments) {
          if (inst.teach_or_perform === 'Teach') {
            const instrumentRow = await (tx as any).teacher_instruments.create({
              data: {
                teacher_id: teacherId,
                instrument: inst.instrument,
                teach_or_perform: inst.teach_or_perform,
                class_mode: inst.class_mode,
                base_price: null,
                performance_fee_inr: null,
                performance_fee_foreign: null,
              },
            })

            const tiers = (inst.tiers || []).map((tier) => {
              const priceForeign = data.open_to_international && data.international_premium
                ? tier.price_inr + data.international_premium
                : null
              return {
                teacher_instrument_id: instrumentRow.id,
                level: tier.level,
                mode: inst.class_mode,
                price_inr: tier.price_inr,
                price_foreign: priceForeign,
              }
            })

            if (tiers.length > 0) {
              await (tx as any).teacher_instrument_tiers.createMany({ data: tiers })
            }
          } else {
            await (tx as any).teacher_instruments.create({
              data: {
                teacher_id: teacherId,
                instrument: inst.instrument,
                teach_or_perform: inst.teach_or_perform,
                class_mode: null,
                base_price: null,
                performance_fee_inr: inst.performance_fee_inr,
                performance_fee_foreign:
                  data.open_to_international && data.international_premium
                    ? inst.performance_fee_inr + data.international_premium
                    : null,
                // Removed open_to_international and international_premium
              },
            })
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

    return {
      ...teacher,
      teacher_languages: languages,
      teacher_engagements: engagements,
      teacher_formats: formats,
      teacher_instruments: instruments,
    }
  }
}
