import prisma from '../config/database'
import { AppError } from '../types'
import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation'

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
}
