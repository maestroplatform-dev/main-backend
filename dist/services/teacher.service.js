"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherService = void 0;
const database_1 = __importDefault(require("../config/database"));
const types_1 = require("../types");
class TeacherService {
    // Complete teacher onboarding
    static async onboard(teacherId, data) {
        // Check if teacher exists
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher record not found', 'TEACHER_NOT_FOUND');
        }
        // Check if already onboarded
        if (teacher.bio) {
            throw new types_1.AppError(409, 'Teacher already onboarded', 'ALREADY_ONBOARDED');
        }
        // Update teacher with onboarding data
        const updated = await database_1.default.teachers.update({
            where: { id: teacherId },
            data: {
                bio: data.bio,
                experience_years: data.experience_years,
            },
        });
        return updated;
    }
    // Get teacher profile
    static async getProfile(teacherId) {
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
            include: {
                profiles: true,
                class_packages: {
                    where: { is_active: true },
                },
                teacher_instruments: true,
                teacher_languages: true,
                teacher_formats: true,
                teacher_engagements: true,
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
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        return teacher;
    }
    // Update teacher profile
    static async updateProfile(teacherId, data) {
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        const updated = await database_1.default.teachers.update({
            where: { id: teacherId },
            data: {
                bio: data.bio,
                experience_years: data.experience_years,
            },
        });
        return updated;
    }
    // Get all teachers (public)
    static async getAllTeachers(filters) {
        const teachers = await database_1.default.teachers.findMany({
            where: {
                verified: filters?.verified,
            },
            include: {
                profiles: true,
                class_packages: {
                    where: { is_active: true },
                },
                teacher_instruments: true,
                teacher_languages: true,
                teacher_formats: true,
            },
            take: filters?.limit || 20,
            skip: filters?.offset || 0,
            orderBy: {
                created_at: 'desc',
            },
        });
        return teachers;
    }
}
exports.TeacherService = TeacherService;
//# sourceMappingURL=teacher.service.js.map