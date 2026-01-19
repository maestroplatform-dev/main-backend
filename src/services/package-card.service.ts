import prisma from '../config/database'
import { AppError } from '../types'
import type { $Enums } from '@prisma/client'

const levelValues = ['beginner', 'intermediate', 'advanced'] as const
export type StudentLevel = $Enums.instrument_level

function assertLevel(level: string): asserts level is StudentLevel {
  if (!levelValues.includes(level as (typeof levelValues)[number])) {
    throw new AppError(400, 'Invalid level', 'INVALID_LEVEL')
  }
}

function validatePoints(points: unknown): asserts points is string[] {
  if (!Array.isArray(points) || points.length !== 4 || points.some((p) => typeof p !== 'string' || p.trim().length === 0)) {
    throw new AppError(400, 'Package card must have exactly 4 non-empty points', 'INVALID_POINTS')
  }
}

export class PackageCardService {
  static async getForStudent(studentId: string) {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
      select: { id: true, level: true },
    })

    if (!student) {
      throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND')
    }

    const override = await prisma.student_package_card_overrides.findUnique({
      where: { student_id: studentId },
      select: { points: true },
    })

    if (override?.points?.length) {
      return {
        level: student.level,
        points: override.points,
        source: 'override' as const,
      }
    }

    const template = await prisma.package_card_templates.findUnique({
      where: { level: student.level },
      select: { points: true },
    })

    return {
      level: student.level,
      points: template?.points?.length ? template.points : null,
      source: template?.points?.length ? ('template' as const) : ('none' as const),
    }
  }

  static async listTemplates() {
    const templates = await prisma.package_card_templates.findMany({
      orderBy: { level: 'asc' },
      select: { level: true, points: true, updated_at: true },
    })

    return templates
  }

  static async upsertTemplate(level: string, points: string[]) {
    const parsedLevel = level
    assertLevel(parsedLevel)
    validatePoints(points)

    const template = await prisma.package_card_templates.upsert({
      where: { level: parsedLevel },
      create: { level: parsedLevel, points },
      update: { points, updated_at: new Date() },
      select: { level: true, points: true, updated_at: true },
    })

    return template
  }

  static async updateStudentPackageCard(studentId: string, input: { level?: string; points?: string[]; clearOverride?: boolean }) {
    const maybeLevel = input.level
    if (maybeLevel) assertLevel(maybeLevel)
    if (input.points) validatePoints(input.points)

    const student = await prisma.students.findUnique({
      where: { id: studentId },
      select: { id: true },
    })

    if (!student) {
      throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND')
    }

    if (maybeLevel) {
      await prisma.students.update({
        where: { id: studentId },
        data: { level: maybeLevel as unknown as $Enums.instrument_level },
      })
    }

    if (input.clearOverride) {
      await prisma.student_package_card_overrides.deleteMany({
        where: { student_id: studentId },
      })
    }

    if (input.points) {
      await prisma.student_package_card_overrides.upsert({
        where: { student_id: studentId },
        create: { student_id: studentId, points: input.points },
        update: { points: input.points, updated_at: new Date() },
      })
    }

    return this.getForStudent(studentId)
  }
}
