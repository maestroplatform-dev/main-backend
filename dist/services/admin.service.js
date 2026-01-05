"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const database_1 = __importDefault(require("../config/database"));
const supabase_1 = require("../config/supabase");
const types_1 = require("../types");
const email_1 = require("../utils/email");
const client_1 = require("@prisma/client");
class AdminService {
    // Get dashboard statistics
    static async getDashboardStats() {
        const [totalUsers, totalTeachers, totalStudents, verifiedTeachers, pendingTeachers, totalBookings, completedBookings, totalRevenue, recentSignups,] = await Promise.all([
            // Total users
            database_1.default.profiles.count(),
            // Total teachers
            database_1.default.teachers.count(),
            // Total students
            database_1.default.students.count(),
            // Verified teachers
            database_1.default.teachers.count({ where: { verified: true } }),
            // Pending teachers (completed onboarding but not verified)
            database_1.default.teachers.count({
                where: {
                    onboarding_completed: true,
                    verified: false
                }
            }),
            // Total bookings
            database_1.default.bookings.count(),
            // Completed bookings
            database_1.default.bookings.count({ where: { status: 'completed' } }),
            // Total revenue
            database_1.default.payments.aggregate({
                where: { status: 'succeeded' },
                _sum: { amount: true }
            }),
            // Users signed up in last 7 days
            database_1.default.profiles.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
        ]);
        return {
            users: {
                total: totalUsers,
                teachers: totalTeachers,
                students: totalStudents,
                recentSignups,
            },
            teachers: {
                total: totalTeachers,
                verified: verifiedTeachers,
                pending: pendingTeachers,
                verificationRate: totalTeachers > 0
                    ? Math.round((verifiedTeachers / totalTeachers) * 100)
                    : 0,
            },
            bookings: {
                total: totalBookings,
                completed: completedBookings,
                completionRate: totalBookings > 0
                    ? Math.round((completedBookings / totalBookings) * 100)
                    : 0,
            },
            revenue: {
                total: totalRevenue._sum.amount || 0,
            },
        };
    }
    // Get all teachers with filters
    static async getTeachers(params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (params.verified !== undefined) {
            where.verified = params.verified === 'true';
        }
        if (params.onboarding_completed !== undefined) {
            where.onboarding_completed = params.onboarding_completed === 'true';
        }
        if (params.search) {
            where.OR = [
                { name: { contains: params.search, mode: 'insensitive' } },
                { bio: { contains: params.search, mode: 'insensitive' } },
                { current_city: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        const [teachers, total] = await Promise.all([
            database_1.default.teachers.findMany({
                where,
                skip,
                take: limit,
                include: {
                    profiles: {
                        select: {
                            name: true,
                            is_active: true,
                            created_at: true,
                        }
                    },
                    teacher_instruments: {
                        select: {
                            instrument: true,
                            teach_or_perform: true,
                            base_price: true,
                        }
                    },
                    teacher_formats: {
                        select: {
                            class_formats: true,
                        }
                    },
                    reviews: {
                        select: {
                            rating: true,
                        }
                    },
                    _count: {
                        select: {
                            bookings: true,
                            reviews: true,
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
            }),
            database_1.default.teachers.count({ where }),
        ]);
        // Calculate average rating for each teacher
        const teachersWithStats = teachers.map(teacher => {
            const avgRating = teacher.reviews.length > 0
                ? teacher.reviews.reduce((sum, r) => sum + r.rating, 0) / teacher.reviews.length
                : 0;
            return {
                ...teacher,
                avgRating: Math.round(avgRating * 10) / 10,
            };
        });
        return {
            teachers: teachersWithStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // Verify/Unverify teacher
    static async updateTeacherVerification(teacherId, verified) {
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
            include: { profiles: true },
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        const updated = await database_1.default.teachers.update({
            where: { id: teacherId },
            data: { verified, updated_at: new Date() },
            include: {
                profiles: true,
            },
        });
        return updated;
    }
    // Get all users with filters
    static async getUsers(params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (params.role) {
            where.role = params.role;
        }
        if (params.is_active !== undefined) {
            where.is_active = params.is_active === 'true';
        }
        if (params.search) {
            where.name = { contains: params.search, mode: 'insensitive' };
        }
        const [users, total] = await Promise.all([
            database_1.default.profiles.findMany({
                where,
                skip,
                take: limit,
                include: {
                    users: {
                        select: {
                            email: true,
                            created_at: true,
                            last_sign_in_at: true,
                        }
                    },
                    teachers: {
                        select: {
                            verified: true,
                            onboarding_completed: true,
                        }
                    },
                    students: {
                        select: {
                            id: true,
                        }
                    },
                },
                orderBy: { created_at: 'desc' },
            }),
            database_1.default.profiles.count({ where }),
        ]);
        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // Update user active status
    static async updateUserStatus(userId, isActive) {
        const user = await database_1.default.profiles.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new types_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
        }
        const updated = await database_1.default.profiles.update({
            where: { id: userId },
            data: { is_active: isActive },
        });
        return updated;
    }
    // Get audit logs
    static async getAuditLogs(params) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            database_1.default.audit_log_entries.findMany({
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
            }),
            database_1.default.audit_log_entries.count(),
        ]);
        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // Admin: Register teacher with complete onboarding data
    static async registerTeacher(data) {
        // Check if user with this email already exists
        const { data: existingUser } = await supabase_1.supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users.some(u => u.email === data.email);
        if (userExists) {
            throw new types_1.AppError(409, 'User with this email already exists', 'USER_EXISTS');
        }
        // Generate secure password
        const password = (0, email_1.generateSecurePassword)();
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password,
            email_confirm: true,
        });
        if (authError || !authData.user) {
            throw new types_1.AppError(500, `Failed to create user: ${authError?.message || 'Unknown error'}`, 'AUTH_USER_CREATION_FAILED');
        }
        const userId = authData.user.id;
        try {
            // Create profile in backend
            const profile = await database_1.default.profiles.create({
                data: {
                    id: userId,
                    name: data.name,
                    role: 'teacher',
                    is_active: true,
                },
            });
            // Create teacher record with full onboarding data
            const teacher = await database_1.default.teachers.create({
                data: {
                    id: userId,
                    name: data.name,
                    verified: false,
                    phone: data.phone,
                    date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
                    music_experience_years: data.music_experience_years,
                    teaching_experience_years: data.teaching_experience_years,
                    performance_experience_years: data.performance_experience_years,
                    current_city: data.current_city,
                    pincode: data.pincode,
                    demo_session_available: data.demo_session_available,
                    media_consent: data.media_consent,
                    engagement_type: data.engagement_type,
                    international_premium: data.international_premium ? new client_1.Prisma.Decimal(data.international_premium) : null,
                    open_to_international: data.open_to_international,
                    onboarding_completed: true, // Mark as onboarded since admin filled everything
                },
            });
            // Create teacher instruments
            if (data.instruments && data.instruments.length > 0) {
                await database_1.default.teacher_instruments.createMany({
                    data: data.instruments.map(inst => ({
                        teacher_id: userId,
                        instrument: inst.instrument,
                        teach_or_perform: inst.teach_or_perform,
                        base_price: inst.base_price ? new client_1.Prisma.Decimal(inst.base_price) : null,
                    })),
                });
            }
            // Create teacher languages
            if (data.languages && data.languages.length > 0) {
                await database_1.default.teacher_languages.createMany({
                    data: data.languages.map(lang => ({
                        teacher_id: userId,
                        language: lang,
                    })),
                });
            }
            // Create teacher formats (single record with array fields)
            if (data.class_formats && data.class_formats.length > 0) {
                await database_1.default.teacher_formats.create({
                    data: {
                        teacher_id: userId,
                        class_formats: data.class_formats,
                        class_formats_other: data.class_formats_other || null,
                        exam_training: data.exam_training || [],
                        exam_training_other: data.exam_training_other || null,
                        additional_formats: data.additional_formats || [],
                        additional_formats_other: data.additional_formats_other || null,
                        learner_groups: data.learner_groups,
                        learner_groups_other: data.learner_groups_other || null,
                        other_contribution: data.other_contribution || null,
                    },
                });
            }
            // Create teacher engagement preferences (single record)
            if (data.engagement_type) {
                await database_1.default.teacher_engagements.create({
                    data: {
                        teacher_id: userId,
                        engagement_type: data.engagement_type,
                        collaborative_projects: data.collaborative_projects || [],
                        collaborative_other: data.collaborative_other || null,
                    },
                });
            }
            // Send credentials email to teacher
            await (0, email_1.sendTeacherCredentialsEmail)(data.email, password, data.name);
            return {
                profile,
                teacher,
                credentials: {
                    email: data.email,
                    password,
                },
            };
        }
        catch (error) {
            // Rollback Supabase user creation if database operations fail
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(userId);
            throw error;
        }
    }
}
exports.AdminService = AdminService;
//# sourceMappingURL=admin.service.js.map