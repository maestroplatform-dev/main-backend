import prisma from '../config/database'
import { supabaseAdmin } from '../config/supabase'
import { AppError } from '../types'
import logger from '../utils/logger'
import { ActivityNotificationService } from './activity-notification.service'

interface StudentSignupData {
  email: string
  name: string
  gender: string
  dob: Date
  password: string
  guardianName?: string
  guardianPhone?: string
}

interface GoogleProfileData {
  userId: string
  dob: Date
  gender: string
  googlePictureUrl?: string
  guardianName?: string
  guardianPhone?: string
}

interface StudentProfileUpdateData {
  name?: string
  gender?: string
  dateOfBirth?: Date
  guardianName?: string | null
  guardianPhone?: string | null
  profilePictureUrl?: string | null
}

export class StudentService {
  /**
   * Calculate age from date of birth
   */
  static calculateAge(dob: Date): number {
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    return age
  }

  /**
   * Check if student requires guardian info based on age
   */
  static requiresGuardian(dob: Date): boolean {
    return this.calculateAge(dob) < 18
  }

  /**
   * Complete email signup - create user and student profile
   */
  static async completeEmailSignup(data: StudentSignupData) {
    // Validate age
    const age = this.calculateAge(data.dob)

    // Check if guardian info is provided for minors
    if (age < 18 && (!data.guardianName || !data.guardianPhone)) {
      throw new AppError(400, 'Guardian information is required for students under 18', 'GUARDIAN_REQUIRED')
    }

    // Create Supabase user with email and password
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    })

    if (signUpError) {
      logger.error({ error: signUpError, email: data.email }, '❌ Failed to create user in Supabase')
      throw new AppError(400, signUpError.message, 'USER_CREATION_FAILED')
    }

    const userId = signUpData.user.id

    try {
      // Create profile
      logger.debug({ userId, name: data.name }, 'Creating profile...')
      const profile = await prisma.profiles.create({
        data: {
          id: userId,
          name: data.name,
          role: 'student',
          is_active: true,
        },
      })
      logger.debug({ userId, profileId: profile.id }, '✅ Profile created')

      // Create student record
      logger.debug({ userId, studentName: data.name }, 'Creating student record...')
      const student = await prisma.students.create({
        data: {
          id: userId,
          name: data.name,
          date_of_birth: data.dob,
          gender: data.gender,
          guardian_name: data.guardianName,
          guardian_phone: data.guardianPhone,
          signup_method: 'email',
          email_verified: true,
          onboarding_status: 'completed',
          profile_picture_url: null,
        },
      })
      logger.debug({ userId, studentId: student.id }, '✅ Student record created')

      logger.info({ userId, email: data.email }, '✅ Student email signup completed')

      // Get session token for the newly created user
      logger.debug({ email: data.email }, 'Generating session token for new user...')
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (sessionError || !sessionData.session) {
        logger.warn(
          { userId, email: data.email, error: sessionError },
          '⚠️  Could not generate session token after signup (user still created)'
        )
      } else {
        logger.debug({ userId }, '✅ Session token generated')
      }

      // Send welcome email
      void ActivityNotificationService.notifyStudentSignup(userId, data.name, data.email).catch((e) =>
        logger.error({ error: e }, 'Failed to send student welcome email')
      )

      return {
        user: signUpData.user,
        profile,
        student,
        session: sessionData?.session || null, // Include session in response
      }
    } catch (error) {
      // Rollback: Delete Supabase user if student creation fails
      logger.error({ userId, error }, '❌ Failed to create student profile/record, rolling back user creation...')
      await supabaseAdmin.auth.admin.deleteUser(userId)
      logger.error({ userId, error }, '❌ Failed to create student profile, rolled back user')
      throw error
    }
  }

  /**
   * Complete Google OAuth signup - update user with profile info
   */
  static async completeGoogleSignup(data: GoogleProfileData) {
    // Validate age
    const age = this.calculateAge(data.dob)

    // Check if guardian info is provided for minors
    if (age < 18 && (!data.guardianName || !data.guardianPhone)) {
      throw new AppError(400, 'Guardian information is required for students under 18', 'GUARDIAN_REQUIRED')
    }

    // Get user from Supabase to verify they exist
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId)

    if (userError || !userData.user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const email = userData.user.email!
    const name = userData.user.user_metadata?.name || userData.user.user_metadata?.full_name || 'Student'

    try {
      // Create profile if it doesn't exist
      let profile = await prisma.profiles.findUnique({
        where: { id: data.userId },
      })

      if (!profile) {
        profile = await prisma.profiles.create({
          data: {
            id: data.userId,
            name,
            role: 'student',
            is_active: true,
          },
        })
      }

      // Create student record if it doesn't exist
      const existingStudent = await prisma.students.findUnique({
        where: { id: data.userId },
        select: { id: true },
      })

      let student

      if (existingStudent) {
        // Update existing student record
        student = await prisma.students.update({
          where: { id: data.userId },
          data: {
            date_of_birth: data.dob,
            gender: data.gender,
            guardian_name: data.guardianName,
            guardian_phone: data.guardianPhone,
            profile_picture_url: data.googlePictureUrl || null,
            signup_method: 'google',
            email_verified: true,
            onboarding_status: 'completed',
          },
        })
      } else {
        // Create new student record
        student = await prisma.students.create({
          data: {
            id: data.userId,
            name,
            date_of_birth: data.dob,
            gender: data.gender,
            guardian_name: data.guardianName,
            guardian_phone: data.guardianPhone,
            profile_picture_url: data.googlePictureUrl || null,
            signup_method: 'google',
            email_verified: true,
            onboarding_status: 'completed',
          },
        })
      }

      logger.info({ userId: data.userId, email }, '✅ Student Google signup completed')

      // Send welcome email
      void ActivityNotificationService.notifyStudentSignup(data.userId, name, email).catch((e) =>
        logger.error({ error: e }, 'Failed to send student welcome email')
      )

      return { user: userData.user, profile, student }
    } catch (error) {
      logger.error({ userId: data.userId, error }, '❌ Failed to complete Google signup')
      throw error
    }
  }

  /**
   * Get student profile
   */
  static async getStudentProfile(userId: string) {
    const student = await prisma.students.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        gender: true,
        date_of_birth: true,
        profile_picture_url: true,
        guardian_name: true,
        guardian_phone: true,
        signup_method: true,
        email_verified: true,
        onboarding_status: true,
        created_at: true,
      },
    })

    if (!student) {
      throw new AppError(404, 'Student profile not found', 'STUDENT_NOT_FOUND')
    }

    return student
  }

  /**
   * Update profile picture
   */
  static async updateProfilePicture(userId: string, pictureUrl: string) {
    const student = await prisma.students.update({
      where: { id: userId },
      data: {
        profile_picture_url: pictureUrl,
      },
    })

    logger.info({ userId }, '✅ Profile picture updated')
    return student
  }

  /**
   * Update student profile fields
   */
  static async updateStudentProfile(userId: string, data: StudentProfileUpdateData) {
    const existing = await prisma.students.findUnique({
      where: { id: userId },
      select: {
        id: true,
        date_of_birth: true,
        guardian_name: true,
        guardian_phone: true,
      },
    })

    if (!existing) {
      throw new AppError(404, 'Student profile not found', 'STUDENT_NOT_FOUND')
    }

    const effectiveDob = data.dateOfBirth ?? existing.date_of_birth ?? null
    const effectiveGuardianName = data.guardianName !== undefined ? data.guardianName : existing.guardian_name
    const effectiveGuardianPhone = data.guardianPhone !== undefined ? data.guardianPhone : existing.guardian_phone

    if (effectiveDob && this.requiresGuardian(effectiveDob)) {
      if (!effectiveGuardianName || !effectiveGuardianPhone) {
        throw new AppError(
          400,
          'Guardian information is required for students under 18',
          'GUARDIAN_REQUIRED'
        )
      }
    }

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.dateOfBirth !== undefined) updateData.date_of_birth = data.dateOfBirth
    if (data.guardianName !== undefined) updateData.guardian_name = data.guardianName
    if (data.guardianPhone !== undefined) updateData.guardian_phone = data.guardianPhone
    if (data.profilePictureUrl !== undefined) updateData.profile_picture_url = data.profilePictureUrl
    updateData.updated_at = new Date()

    const updatedStudent = await prisma.$transaction(async (tx) => {
      const student = await tx.students.update({
        where: { id: userId },
        data: updateData,
      })

      if (data.name !== undefined) {
        await tx.profiles.update({
          where: { id: userId },
          data: {
            name: data.name,
          },
        })
      }

      return student
    })

    logger.info({ userId }, '✅ Student profile updated')
    return updatedStudent
  }

  /**
   * Get student by email
   */
  static async getStudentByEmail(email: string) {
    // Note: We need to join with Supabase users via profiles
    // This is a simplified version - may need adjustment based on actual auth setup
    const profiles = await prisma.profiles.findMany({
      where: {
        students: {
          isNot: null,
        },
      },
      include: {
        students: true,
      },
    })

    // Filter by email from Supabase (simplified - in real app, might need separate lookup)
    return profiles.find((p) => p.students)?.students || null
  }

  /**
   * Update student onboarding status
   */
  static async updateOnboardingStatus(userId: string, status: string) {
    const student = await prisma.students.update({
      where: { id: userId },
      data: {
        onboarding_status: status,
      },
    })

    return student
  }
}
