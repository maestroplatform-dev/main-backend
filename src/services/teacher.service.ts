import prisma from '../config/database'
import { AppError } from '../types'
import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation'
import { SectionReviewService } from './section-review.service'
import { computeStartingPrice, buildPricingConfig } from '../utils/pricing'
import { randomUUID } from 'crypto'

type PointerLevel = 'beginner' | 'intermediate' | 'advanced'
type PointerSession = '10' | '20' | '30'

type PackageCardPoints = Record<PointerLevel, Record<PointerSession, string[]>>

type PointerGenerationJob = {
  requestId: string
  teacherId: string
  status: 'pending' | 'ready' | 'error'
  package_card_points: PackageCardPoints | null
  error: string | null
  createdAt: number
}

export class TeacherService {
  private static pointerGenerationJobs = new Map<string, PointerGenerationJob>()
  private static POINTER_JOB_TTL_MS = 24 * 60 * 60 * 1000

  private static cleanupExpiredPointerJobs() {
    const now = Date.now()
    for (const [key, job] of this.pointerGenerationJobs.entries()) {
      if (now - job.createdAt > this.POINTER_JOB_TTL_MS) {
        this.pointerGenerationJobs.delete(key)
      }
    }
  }

  private static buildPointerCallbackUrl(): string | null {
    if (process.env.N8N_POINTERS_CALLBACK_URL) return process.env.N8N_POINTERS_CALLBACK_URL
    if (process.env.API_BASE_URL) {
      return `${process.env.API_BASE_URL.replace(/\/$/, '')}/api/v1/teachers/instruments/pointer-callback`
    }
    return null
  }

  private static defaultPackageCardPoints(): PackageCardPoints {
    return {
      beginner: { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] },
      intermediate: { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] },
      advanced: { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] },
    }
  }

  private static normalizePackageCardPoints(raw: any): PackageCardPoints {
    const out = this.defaultPackageCardPoints()
    if (!raw || typeof raw !== 'object') return out

    const levels: PointerLevel[] = ['beginner', 'intermediate', 'advanced']
    const sessions: PointerSession[] = ['10', '20', '30']

    for (const level of levels) {
      const levelRaw = raw[level]
      if (!levelRaw || typeof levelRaw !== 'object') continue

      for (const session of sessions) {
        const sessionRaw = levelRaw[session]
        if (!Array.isArray(sessionRaw)) continue

        const clean = sessionRaw
          .slice(0, 4)
          .map((value: unknown) => (typeof value === 'string' ? value : String(value ?? '')))

        while (clean.length < 4) clean.push('')
        out[level][session] = clean
      }
    }

    return out
  }

  static async queueInstrumentPointerGeneration(
    teacherId: string,
    data: {
      instrument_name: string
      teach_or_perform: 'teach' | 'perform'
      class_mode?: 'online' | 'offline' | null
      pricing: {
        beginner: number
        intermediate: number
        advanced: number
      }
    }
  ) {
    this.cleanupExpiredPointerJobs()

    const teacher = await this.getProfile(teacherId)
    const requestId = randomUUID()
    const callbackUrl = this.buildPointerCallbackUrl()
    const webhookUrl = process.env.N8N_POINTERS_WEBHOOK_URL

    const job: PointerGenerationJob = {
      requestId,
      teacherId,
      status: 'pending',
      package_card_points: null,
      error: null,
      createdAt: Date.now(),
    }
    this.pointerGenerationJobs.set(requestId, job)

    if (!webhookUrl) {
      job.status = 'error'
      job.error = 'N8N_POINTERS_WEBHOOK_URL not configured'
      return { queued: false, requestId, reason: job.error }
    }

    if (!callbackUrl) {
      job.status = 'error'
      job.error = 'Pointer callback URL is not configured'
      return { queued: false, requestId, reason: job.error }
    }

    const payload = {
      request_id: requestId,
      teacher_id: teacherId,
      instrument_data: data,
      teacher_profile: {
        name: teacher.name,
        bio: teacher.bio,
        tagline: teacher.tagline,
        teaching_style: teacher.teaching_style,
        education: teacher.education,
        professional_experience: teacher.professional_experience,
        current_city: teacher.current_city,
        music_experience_years: teacher.music_experience_years,
        teaching_experience_years: teacher.teaching_experience_years,
        performance_experience_years: teacher.performance_experience_years,
        languages: (teacher.teacher_languages || []).map((l: any) => l.language),
      },
      callbackUrl,
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_CALLBACK_SECRET ? { Authorization: `Bearer ${process.env.N8N_CALLBACK_SECRET}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.text()
        job.status = 'error'
        job.error = `n8n rejected request (${response.status}): ${body}`
        return { queued: false, requestId, reason: job.error }
      }
    } catch (error: any) {
      job.status = 'error'
      job.error = error?.message || 'Failed to call n8n'
      return { queued: false, requestId, reason: job.error }
    }

    return { queued: true, requestId }
  }

  static getInstrumentPointerGenerationStatus(teacherId: string, requestId: string) {
    this.cleanupExpiredPointerJobs()

    const job = this.pointerGenerationJobs.get(requestId)
    if (!job || job.teacherId !== teacherId) {
      throw new AppError(404, 'Pointer generation request not found', 'POINTER_REQUEST_NOT_FOUND')
    }

    if (job.status === 'ready') {
      return {
        request_id: requestId,
        status: 'ready',
        package_card_points: job.package_card_points,
      }
    }

    if (job.status === 'error') {
      return {
        request_id: requestId,
        status: 'error',
        error: job.error,
      }
    }

    return {
      request_id: requestId,
      status: 'pending',
    }
  }

  static async applyInstrumentPointerCallback(data: {
    request_id: string
    teacher_id?: string
    package_card_points?: unknown
    error?: string
  }) {
    this.cleanupExpiredPointerJobs()

    const job = this.pointerGenerationJobs.get(data.request_id)
    if (!job) {
      if (!data.teacher_id) {
        return {
          updated: false,
          reason: 'request not found or expired, and teacher_id missing for recovery',
          request_id: data.request_id,
        }
      }

      const recoveredJob: PointerGenerationJob = {
        requestId: data.request_id,
        teacherId: data.teacher_id,
        status: data.error ? 'error' : 'ready',
        package_card_points: data.error ? null : this.normalizePackageCardPoints(data.package_card_points),
        error: data.error || null,
        createdAt: Date.now(),
      }

      this.pointerGenerationJobs.set(data.request_id, recoveredJob)

      return {
        updated: true,
        recovered: true,
        status: recoveredJob.status,
        reason: 'request was missing in memory and has been recovered from callback payload',
      }
    }

    if (data.teacher_id && data.teacher_id !== job.teacherId) {
      return { updated: false, reason: 'teacher mismatch' }
    }

    if (data.error) {
      job.status = 'error'
      job.error = data.error
      return { updated: true, status: 'error' }
    }

    job.package_card_points = this.normalizePackageCardPoints(data.package_card_points)
    job.status = 'ready'
    job.error = null

    return { updated: true, status: 'ready' }
  }

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

    // ── Pricing config (admin-overridable per teacher) ───────────────────
    const toNum = (raw: any): number | null => {
      if (raw === null || raw === undefined) return null
      if (typeof raw === 'object' && typeof raw.toNumber === 'function') return raw.toNumber()
      if (typeof raw === 'number') return raw
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    }

    // Default multiplier percentages
    const pricingConfig = buildPricingConfig(teacher)

    // Compute minimum student-facing starting price using new formula
    // Starting price = lowest per-class price across all tiers at the 30-session level
    let minPrice: number | null = null
    if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
      teacher.teacher_instruments.forEach((inst: any) => {
        if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
          inst.teacher_instrument_tiers.forEach((tier: any) => {
            const teacherBasePrice = toNum(tier.price_inr)

            if (teacherBasePrice !== null && teacherBasePrice > 0) {
              // Compute 30-session per-class price (lowest tier = starting price)
              const perClass30 = computeStartingPrice(teacherBasePrice, pricingConfig ?? undefined)

              if (minPrice === null || perClass30 < minPrice) {
                minPrice = perClass30
              }
            }
          })
        }
      })
    }

    // Only include pricing_config if any override is set
    return {
      ...teacher,
      teacher_instruments: teacher.teacher_instruments?.map((inst: any) => ({
        ...inst,
        package_card_points: normalize(inst.package_card_points),
      })) || [],
      starting_price: minPrice,
      ...(pricingConfig ? { pricing_config: pricingConfig } : {}),
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
    if (data.open_to_international !== undefined) updateData.open_to_international = data.open_to_international
    if (data.international_premium !== undefined) updateData.international_premium = data.international_premium

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

    // Void profile section approval if approved/pending
    await SectionReviewService.voidSectionApproval(teacherId, 'profile')

    return updated
  }

  // Get all teachers (public) with server-side search, filtering, sorting, pagination
  static async getAllTeachers(filters?: {
    verified?: boolean
    limit?: number
    offset?: number
    search?: string
    instrument?: string
    city?: string
    level?: string
    mode?: string
    minPrice?: number
    maxPrice?: number
    sortBy?: string
  }): Promise<{ teachers: any[]; total: number }> {
    // Build Prisma WHERE clause
    const where: any = {}
    if (filters?.verified !== undefined) {
      where.verified = filters.verified
    }

    const AND: any[] = []

    // Full-text search across name, bio, city, instruments
    if (filters?.search) {
      AND.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { bio: { contains: filters.search, mode: 'insensitive' } },
          { current_city: { contains: filters.search, mode: 'insensitive' } },
          {
            teacher_instruments: {
              some: {
                instrument: { contains: filters.search, mode: 'insensitive' },
                teach_or_perform: { equals: 'teach', mode: 'insensitive' },
              },
            },
          },
        ],
      })
    }

    // Instrument filter
    if (filters?.instrument) {
      AND.push({
        teacher_instruments: {
          some: {
            instrument: { contains: filters.instrument, mode: 'insensitive' },
            teach_or_perform: { equals: 'teach', mode: 'insensitive' },
          },
        },
      })
    }

    // City filter
    if (filters?.city) {
      AND.push({
        current_city: { contains: filters.city, mode: 'insensitive' },
      })
    }

    // Level/mode filters should match actual tier pricing data (same source used by frontend cards)
    const normalizedLevel = filters?.level?.trim().toLowerCase()
    const normalizedMode = filters?.mode?.trim().toLowerCase()

    if (normalizedLevel || normalizedMode) {
      const tierWhere: any = {
        price_inr: { gt: 0 },
      }

      if (normalizedLevel) {
        tierWhere.level = { equals: normalizedLevel }
      }

      if (normalizedMode) {
        tierWhere.mode = { equals: normalizedMode }
      }

      const instrumentWhere: any = {
        teacher_instrument_tiers: {
          some: tierWhere,
        },
      }

      // If instrument filter is present, ensure level/mode match within that instrument
      if (filters?.instrument) {
        instrumentWhere.instrument = { contains: filters.instrument, mode: 'insensitive' }
        instrumentWhere.teach_or_perform = { equals: 'teach', mode: 'insensitive' }
      }

      AND.push({
        teacher_instruments: {
          some: instrumentWhere,
        },
      })
    }

    if (AND.length > 0) {
      where.AND = AND
    }

    const hasPriceFilter = filters?.minPrice != null || filters?.maxPrice != null

    // Sort direction (price sorts need JS post-processing)
    const sortBy = filters?.sortBy || 'az'
    const needsJsSort = sortBy === 'price_asc' || sortBy === 'price_desc'

    // Build Prisma orderBy for name-based sorts (applied at DB level)
    let orderBy: any | undefined
    if (sortBy === 'az') orderBy = { name: 'asc' }
    else if (sortBy === 'za') orderBy = { name: 'desc' }

    const offset = filters?.offset || 0
    const limit = filters?.limit || 20

    // Optimisation: when we don't need price filtering or price sorting,
    // we can paginate at the DB level and avoid loading every teacher.
    const canDbPaginate = !hasPriceFilter && !needsJsSort

    // Fetch teachers — paginate at DB level when possible
    const [teachers, totalCount] = await Promise.all([
      prisma.teachers.findMany({
        where,
        include: {
          teacher_languages: true,
          teacher_formats: true,
          teacher_instruments: {
            include: {
              teacher_instrument_tiers: true,
            },
          },
        },
        ...(orderBy ? { orderBy } : {}),
        ...(canDbPaginate ? { skip: offset, take: limit } : {}),
      }),
      prisma.teachers.count({ where }),
    ])

    // Helper to convert Prisma Decimal to number
    const toNum = (raw: any): number | null => {
      if (raw === null || raw === undefined) return null
      if (typeof raw === 'object' && typeof raw.toNumber === 'function') return raw.toNumber()
      if (typeof raw === 'number') return raw
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
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

    // Compute starting prices + normalize
    const teachersWithPrice = teachers.map((teacher: any) => {
      const pricingConfig = buildPricingConfig(teacher)
      let minPrice: number | null = null

      if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
        teacher.teacher_instruments.forEach((inst: any) => {
          if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
            inst.teacher_instrument_tiers.forEach((tier: any) => {
              const teacherBasePrice = toNum(tier.price_inr)
              if (teacherBasePrice !== null && teacherBasePrice > 0) {
                const perClass30 = computeStartingPrice(teacherBasePrice, pricingConfig ?? undefined)
                if (minPrice === null || perClass30 < minPrice) {
                  minPrice = perClass30
                }
              }
            })
          }
        })
      }

      return {
        ...teacher,
        starting_price_inr: minPrice,
        teacher_instruments: teacher.teacher_instruments?.map((inst: any) => ({
          ...inst,
          package_card_points: normalize(inst.package_card_points),
        })) || [],
      }
    })

    // Post-computation: filter by price range (only when price filter is active)
    let filtered = teachersWithPrice
    if (hasPriceFilter) {
      filtered = filtered.filter((t) => {
        const price = t.starting_price_inr || 0
        if (filters!.minPrice != null && price < filters!.minPrice) return false
        if (filters!.maxPrice != null && price > filters!.maxPrice) return false
        return true
      })
    }

    // Sort by price if needed (name sorts handled at DB level)
    if (needsJsSort) {
      if (sortBy === 'price_asc') {
        filtered.sort((a, b) => (a.starting_price_inr || 0) - (b.starting_price_inr || 0))
      } else {
        filtered.sort((a, b) => (b.starting_price_inr || 0) - (a.starting_price_inr || 0))
      }
    }

    // If we already paginated at DB level, return as-is
    if (canDbPaginate) {
      return { teachers: filtered, total: totalCount }
    }

    // Otherwise paginate in JS (price filter/sort required full fetch)
    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)

    return { teachers: paginated, total }
  }

  // Get teacher bank details
  static async getBankDetails(teacherId: string) {
    const bankDetails = await prisma.teacher_bank_details.findUnique({
      where: { teacher_id: teacherId },
    })

    return bankDetails
  }

  // Get teacher earnings overview for dashboard
  static async getEarningsOverview(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      select: { id: true },
    })

    if (!teacher) {
      throw new AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND')
    }

    const completedBookings = await prisma.bookings.findMany({
      where: {
        teacher_id: teacherId,
        status: 'COMPLETED',
        is_demo: false,
      },
      select: {
        id: true,
        scheduled_at: true,
        duration_minutes: true,
        purchased_packages: {
          select: {
            price_per_session: true,
          },
        },
      },
      orderBy: {
        scheduled_at: 'desc',
      },
    })

    const rows = completedBookings.map((booking) => {
      const sessionDate = new Date(booking.scheduled_at)
      const durationMinutes = booking.duration_minutes || 60
      const hours = durationMinutes / 60
      const earnings = Number(booking.purchased_packages?.price_per_session || 0)

      return {
        date: sessionDate,
        hours,
        earnings,
      }
    })

    const round2 = (value: number) => Math.round(value * 100) / 100
    const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const financialYearStart = new Date(fyStartYear, 3, 1)
    const nextFinancialYearStart = new Date(fyStartYear + 1, 3, 1)

    const inRange = (date: Date, start: Date, end: Date) => date >= start && date < end

    const totalEarnings = round2(sum(rows.map((row) => row.earnings)))
    const totalHours = round2(sum(rows.map((row) => row.hours)))

    const thisMonthRows = rows.filter((row) => inRange(row.date, currentMonthStart, nextMonthStart))
    const lastMonthRows = rows.filter((row) => inRange(row.date, lastMonthStart, currentMonthStart))
    const thisFinancialYearRows = rows.filter((row) =>
      inRange(row.date, financialYearStart, nextFinancialYearStart)
    )

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

    const getMonthStatus = (monthKey: string): 'Paid' | 'Pending' | 'Processing' => {
      if (monthKey === currentMonthKey) return 'Pending'
      if (monthKey === previousMonthKey) return 'Processing'
      return 'Paid'
    }

    const monthlyMap = new Map<string, { monthDate: Date; hours_completed: number; total_earnings: number }>()

    rows.forEach((row) => {
      const monthKey = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`
      const monthStart = new Date(row.date.getFullYear(), row.date.getMonth(), 1)
      const current = monthlyMap.get(monthKey)

      if (!current) {
        monthlyMap.set(monthKey, {
          monthDate: monthStart,
          hours_completed: row.hours,
          total_earnings: row.earnings,
        })
      } else {
        current.hours_completed += row.hours
        current.total_earnings += row.earnings
      }
    })

    const monthlySummary = Array.from(monthlyMap.entries())
      .sort((a, b) => b[1].monthDate.getTime() - a[1].monthDate.getTime())
      .map(([monthKey, data]) => ({
        month: data.monthDate.toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        }),
        hours_completed: round2(data.hours_completed),
        total_earnings: round2(data.total_earnings),
        status: getMonthStatus(monthKey),
      }))

    const getWeekStart = (date: Date) => {
      const weekStart = new Date(date)
      weekStart.setHours(0, 0, 0, 0)
      const day = weekStart.getDay()
      const diff = (day + 6) % 7 // Monday as start
      weekStart.setDate(weekStart.getDate() - diff)
      return weekStart
    }

    const weeklyMap = new Map<string, { weekStart: Date; hours_completed: number; total_earnings: number }>()

    rows.forEach((row) => {
      const weekStart = getWeekStart(row.date)
      const weekKey = weekStart.toISOString().split('T')[0]
      const current = weeklyMap.get(weekKey)

      if (!current) {
        weeklyMap.set(weekKey, {
          weekStart,
          hours_completed: row.hours,
          total_earnings: row.earnings,
        })
      } else {
        current.hours_completed += row.hours
        current.total_earnings += row.earnings
      }
    })

    const currentWeekStart = getWeekStart(now)
    const previousWeekStart = new Date(currentWeekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)

    const weeklySummary = Array.from(weeklyMap.entries())
      .sort((a, b) => b[1].weekStart.getTime() - a[1].weekStart.getTime())
      .map(([weekKey, data]) => {
        const isCurrentWeek = weekKey === currentWeekStart.toISOString().split('T')[0]
        const isPreviousWeek = weekKey === previousWeekStart.toISOString().split('T')[0]

        return {
          month: `Week of ${data.weekStart.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`,
          hours_completed: round2(data.hours_completed),
          total_earnings: round2(data.total_earnings),
          status: isCurrentWeek ? 'Pending' : isPreviousWeek ? 'Processing' : 'Paid' as 'Paid' | 'Pending' | 'Processing',
        }
      })

    return {
      stats: {
        total_earnings: totalEarnings,
        total_hours: totalHours,
        this_financial_year: round2(sum(thisFinancialYearRows.map((row) => row.earnings))),
        this_financial_year_hours: round2(sum(thisFinancialYearRows.map((row) => row.hours))),
        last_month: round2(sum(lastMonthRows.map((row) => row.earnings))),
        last_month_hours: round2(sum(lastMonthRows.map((row) => row.hours))),
        this_month: round2(sum(thisMonthRows.map((row) => row.earnings))),
        this_month_hours: round2(sum(thisMonthRows.map((row) => row.hours))),
      },
      summary: {
        monthly: monthlySummary,
        weekly: weeklySummary,
      },
    }
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
    package_card_points?: any
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
        package_card_points: data.package_card_points ?? null,
      },
    })

    // Create tiers if provided
    if (data.tiers && data.tiers.length > 0) {
      // Use teacher's profile-level international settings
      const isIntl = teacher.open_to_international
      const intlPremium = Number(teacher.international_premium) || 0

      await prisma.teacher_instrument_tiers.createMany({
        data: data.tiers.map(tier => ({
          teacher_instrument_id: instrument.id,
          level: tier.level as any,
          mode: tier.mode as any,
          price_inr: tier.price_inr,
          price_foreign: isIntl && intlPremium
            ? tier.price_inr + intlPremium
            : null,
        })),
      })
    }

    // Fetch and return with tiers
    const result = await prisma.teacher_instruments.findUnique({
      where: { id: instrument.id },
      include: { teacher_instrument_tiers: true },
    })

    // Void pricing section approval if approved/pending
    await SectionReviewService.voidSectionApproval(teacherId, 'pricing')

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
    package_card_points?: any
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
    if (data.package_card_points !== undefined) updateData.package_card_points = data.package_card_points

    await prisma.teacher_instruments.update({
      where: { id: instrumentId },
      data: updateData,
    })

    // Update tiers if provided
    if (data.tiers) {
      // Look up teacher's profile-level international settings
      const teacher = await prisma.teachers.findUnique({
        where: { id: teacherId },
        select: { open_to_international: true, international_premium: true },
      })
      const isIntl = teacher?.open_to_international
      const intlPremium = Number(teacher?.international_premium) || 0

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
            price_foreign: isIntl && intlPremium
              ? tier.price_inr + intlPremium
              : null,
          })),
        })
      }
    }

    // Fetch and return with tiers
    const result = await prisma.teacher_instruments.findUnique({
      where: { id: instrumentId },
      include: { teacher_instrument_tiers: true },
    })

    // Void pricing section approval if approved/pending
    await SectionReviewService.voidSectionApproval(teacherId, 'pricing')

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

    // Void pricing section approval if approved/pending
    await SectionReviewService.voidSectionApproval(teacherId, 'pricing')

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

    return {
      sections,
      completionPercentage,
    }
  }
}
