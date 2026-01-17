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

    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        bio: data.bio,
        experience_years: data.experience_years,
      },
    })

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

      return {
        ...teacher,
        starting_price: minPrice,
      }
    })

    return teachersWithStartingPrice
  }
}
