import prisma from '../config/database'
import { AppError } from '../types'
import logger from '../utils/logger'
import { ActivityNotificationService } from './activity-notification.service'

export interface StudentPreferencesData {
  instruments: string[]
  learning_mode: 'online' | 'offline' | 'both'
  location?: string
  budget_min?: number
  budget_max?: number
  learning_goals: string[]
  skill_level: 'beginner' | 'intermediate' | 'advanced'
}

export class StudentPreferencesService {
  /**
   * Save or update student quiz preferences
   */
  static async savePreferences(studentId: string, data: StudentPreferencesData) {
    try {
      // Check if student exists
      const student = await prisma.students.findUnique({
        where: { id: studentId },
        select: { id: true },
      })

      if (!student) {
        throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND')
      }

      // Upsert preferences
      const preferences = await prisma.student_preferences.upsert({
        where: { student_id: studentId },
        create: {
          student_id: studentId,
          instruments: data.instruments,
          learning_mode: data.learning_mode,
          location: data.location,
          budget_min: data.budget_min,
          budget_max: data.budget_max,
          learning_goals: data.learning_goals,
          skill_level: data.skill_level,
          quiz_completed: true,
        },
        update: {
          instruments: data.instruments,
          learning_mode: data.learning_mode,
          location: data.location,
          budget_min: data.budget_min,
          budget_max: data.budget_max,
          learning_goals: data.learning_goals,
          skill_level: data.skill_level,
          quiz_completed: true,
          updated_at: new Date(),
        },
      })

      logger.info({ studentId }, '✅ Student preferences saved')

      // Send preferences-received email
      try {
        const student = await prisma.students.findUnique({
          where: { id: studentId },
          select: { name: true, profiles: { select: { users: { select: { email: true } } } } },
        })
        const email = student?.profiles?.users?.email
        if (email) {
          void ActivityNotificationService.notifyPreferencesReceived(email, {
            studentName: student?.name || 'Student',
            instrument: data.instruments.join(', '),
            mode: data.learning_mode,
            feeRange: data.budget_min && data.budget_max ? `₹${data.budget_min} - ₹${data.budget_max}` : '-',
            level: data.skill_level,
            learningGoals: data.learning_goals.join(', '),
          }).catch((e) => logger.error({ error: e }, 'Failed to send preferences email'))
        }
      } catch (e) {
        logger.error({ error: e }, 'Failed to look up student for preferences email')
      }

      return preferences
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error({ error, studentId }, '❌ Failed to save student preferences')
      throw new AppError(500, 'Failed to save preferences', 'PREFERENCES_SAVE_FAILED')
    }
  }

  /**
   * Get student preferences
   */
  static async getPreferences(studentId: string) {
    try {
      const preferences = await prisma.student_preferences.findUnique({
        where: { student_id: studentId },
      })

      return preferences
    } catch (error) {
      logger.error({ error, studentId }, '❌ Failed to get student preferences')
      throw new AppError(500, 'Failed to get preferences', 'PREFERENCES_GET_FAILED')
    }
  }

  /**
   * Check if student has completed the quiz
   */
  static async hasCompletedQuiz(studentId: string): Promise<boolean> {
    try {
      const preferences = await prisma.student_preferences.findUnique({
        where: { student_id: studentId },
        select: { quiz_completed: true },
      })

      return preferences?.quiz_completed ?? false
    } catch (error) {
      logger.error({ error, studentId }, '❌ Failed to check quiz status')
      return false
    }
  }

  /**
   * Get preferences formatted for teacher search filters
   */
  static async getSearchFilters(studentId: string) {
    const preferences = await this.getPreferences(studentId)

    if (!preferences) {
      return null
    }

    return {
      instruments: preferences.instruments,
      mode: preferences.learning_mode === 'both' ? undefined : preferences.learning_mode,
      city: preferences.location,
      level: preferences.skill_level,
      priceMin: preferences.budget_min,
      priceMax: preferences.budget_max,
    }
  }
}
