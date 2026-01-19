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
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        const normalize = (raw) => {
            if (!raw)
                return null;
            const levels = ['beginner', 'intermediate', 'advanced'];
            const out = {};
            for (const level of levels) {
                const val = raw[level];
                if (!val) {
                    out[level] = { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] };
                }
                else if (Array.isArray(val)) {
                    out[level] = { '10': val, '20': val, '30': val };
                }
                else {
                    out[level] = {
                        '10': val['10'] || ['', '', '', ''],
                        '20': val['20'] || ['', '', '', ''],
                        '30': val['30'] || ['', '', '', ''],
                    };
                }
            }
            return out;
        };
        // Compute minimum student-facing starting price from all instruments and tiers
        let minPrice = null;
        if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
            teacher.teacher_instruments.forEach((inst) => {
                if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
                    inst.teacher_instrument_tiers.forEach((tier) => {
                        const raw = tier.price_inr;
                        const teacherPrice = raw && typeof raw === 'object' && typeof raw.toNumber === 'function'
                            ? raw.toNumber()
                            : typeof raw === 'number'
                                ? raw
                                : null;
                        const rawMarkup = tier.platform_markup_inr;
                        const markup = rawMarkup && typeof rawMarkup === 'object' && typeof rawMarkup.toNumber === 'function'
                            ? rawMarkup.toNumber()
                            : typeof rawMarkup === 'number'
                                ? rawMarkup
                                : 0;
                        const studentPrice = teacherPrice !== null ? teacherPrice + markup : null;
                        if (studentPrice !== null && (minPrice === null || studentPrice < minPrice)) {
                            minPrice = studentPrice;
                        }
                    });
                }
                const rawBase = inst.base_price;
                const basePrice = rawBase && typeof rawBase === 'object' && typeof rawBase.toNumber === 'function'
                    ? rawBase.toNumber()
                    : typeof rawBase === 'number'
                        ? rawBase
                        : null;
                if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
                    minPrice = basePrice;
                }
            });
        }
        return {
            ...teacher,
            teacher_instruments: teacher.teacher_instruments?.map((inst) => ({
                ...inst,
                package_card_points: normalize(inst.package_card_points),
            })) || [],
            starting_price: minPrice,
        };
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
        });
        const teachersWithStartingPrice = teachers.map((teacher) => {
            let minPrice = null;
            if (teacher.teacher_instruments && teacher.teacher_instruments.length > 0) {
                teacher.teacher_instruments.forEach((inst) => {
                    if (inst.teacher_instrument_tiers && inst.teacher_instrument_tiers.length > 0) {
                        inst.teacher_instrument_tiers.forEach((tier) => {
                            const raw = tier.price_inr;
                            const teacherPrice = raw && typeof raw === 'object' && typeof raw.toNumber === 'function'
                                ? raw.toNumber()
                                : typeof raw === 'number'
                                    ? raw
                                    : null;
                            const rawMarkup = tier.platform_markup_inr;
                            const markup = rawMarkup && typeof rawMarkup === 'object' && typeof rawMarkup.toNumber === 'function'
                                ? rawMarkup.toNumber()
                                : typeof rawMarkup === 'number'
                                    ? rawMarkup
                                    : 0;
                            const studentPrice = teacherPrice !== null ? teacherPrice + markup : null;
                            if (studentPrice !== null && (minPrice === null || studentPrice < minPrice)) {
                                minPrice = studentPrice;
                            }
                        });
                    }
                    const rawBase = inst.base_price;
                    const basePrice = rawBase && typeof rawBase === 'object' && typeof rawBase.toNumber === 'function'
                        ? rawBase.toNumber()
                        : typeof rawBase === 'number'
                            ? rawBase
                            : null;
                    if (basePrice !== null && (minPrice === null || basePrice < minPrice)) {
                        minPrice = basePrice;
                    }
                });
            }
            const normalize = (raw) => {
                if (!raw)
                    return null;
                const levels = ['beginner', 'intermediate', 'advanced'];
                const out = {};
                for (const level of levels) {
                    const val = raw[level];
                    if (!val) {
                        out[level] = { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] };
                    }
                    else if (Array.isArray(val)) {
                        out[level] = { '10': val, '20': val, '30': val };
                    }
                    else {
                        out[level] = {
                            '10': val['10'] || ['', '', '', ''],
                            '20': val['20'] || ['', '', '', ''],
                            '30': val['30'] || ['', '', '', ''],
                        };
                    }
                }
                return out;
            };
            return {
                ...teacher,
                teacher_instruments: teacher.teacher_instruments?.map((inst) => ({
                    ...inst,
                    package_card_points: normalize(inst.package_card_points),
                })) || [],
                starting_price: minPrice,
            };
        });
        return teachersWithStartingPrice;
    }
}
exports.TeacherService = TeacherService;
//# sourceMappingURL=teacher.service.js.map