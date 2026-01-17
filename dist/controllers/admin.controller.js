"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const types_1 = require("../types");
const admin_service_1 = require("../services/admin.service");
const validation_1 = require("../utils/validation");
const teacher_onboarding_service_1 = require("../services/teacher-onboarding.service");
const database_1 = __importDefault(require("../config/database"));
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = __importDefault(require("../utils/logger"));
class AdminController {
    // POST /api/v1/admin/teachers/register - Admin register a new teacher (creates user + profile + onboarding)
    static async registerTeacher(req, res) {
        logger_1.default.info({ adminId: req.user?.id, email: req.body.email }, '🔵 Admin registering new teacher...');
        const data = validation_1.teacherCompleteOnboardingSchema.extend({
            email: require('zod').z.string().email('Invalid email'),
            name: require('zod').z.string().min(1, 'Name is required'),
        }).parse(req.body);
        const result = await admin_service_1.AdminService.registerTeacher(req.user.id, data);
        logger_1.default.info({ adminId: req.user?.id, teacherId: result.teacher.id }, '✅ Teacher registered by admin successfully');
        res.status(201).json({
            success: true,
            data: {
                message: 'Teacher registered successfully',
                credentials: result.credentials,
                teacher: result.teacher,
            },
        });
    }
    // GET /api/v1/admin/stats - Dashboard statistics
    static async getDashboardStats(_req, res) {
        const stats = await admin_service_1.AdminService.getDashboardStats();
        res.json({
            success: true,
            data: stats,
        });
    }
    // GET /api/v1/admin/teachers - List teachers with filters
    static async listTeachers(req, res) {
        const result = await admin_service_1.AdminService.getTeachers({
            verified: req.query.verified,
            onboarding_completed: req.query.onboarding_completed,
            search: req.query.search,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
        });
        res.json({
            success: true,
            data: result.teachers,
            meta: result.pagination,
        });
    }
    // GET /api/v1/admin/teachers/:id - Get detailed teacher information
    static async getTeacherDetails(req, res) {
        const { id } = req.params;
        const teacher = await admin_service_1.AdminService.getTeacherDetails(id);
        res.json({
            success: true,
            data: teacher,
        });
    }
    // PATCH /api/v1/admin/teachers/:id/verify - Verify/Unverify teacher
    static async updateTeacherVerification(req, res) {
        const { id } = req.params;
        const { verified } = req.body;
        const teacher = await admin_service_1.AdminService.updateTeacherVerification(id, verified);
        res.json({
            success: true,
            data: teacher,
            message: `Teacher ${verified ? 'verified' : 'unverified'} successfully`,
        });
    }
    // GET /api/v1/admin/teachers/:id/onboarding - Get full onboarding-style data for a teacher
    static async getTeacherOnboardingData(req, res) {
        const { id } = req.params;
        const data = await teacher_onboarding_service_1.TeacherOnboardingService.getOnboardingData(id);
        res.status(200).json({
            success: true,
            data,
        });
    }
    // PUT /api/v1/admin/teachers/:id - Update teacher details (same schema as onboarding)
    static async updateTeacherDetails(req, res) {
        const { id } = req.params;
        // Allow optional name/email updates in addition to onboarding data
        const schema = validation_1.teacherCompleteOnboardingSchema.extend({
            name: require('zod').z.string().min(1).optional(),
            email: require('zod').z.string().email().optional(),
        });
        const parsed = schema.parse(req.body);
        const { name, email, ...onboardingData } = parsed;
        // Complete onboarding-style update for teacher-related tables
        const updated = await teacher_onboarding_service_1.TeacherOnboardingService.completeOnboarding(id, onboardingData);
        // Update display name in profiles and teachers if provided
        if (name) {
            await database_1.default.profiles.update({
                where: { id },
                data: { name },
            });
            await database_1.default.teachers.update({
                where: { id },
                data: { name },
            });
        }
        // Update Supabase auth email if provided
        if (email) {
            const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { error } = await supabase.auth.admin.updateUserById(id, { email });
            if (error) {
                throw new types_1.AppError(400, error.message, 'EMAIL_UPDATE_FAILED');
            }
        }
        res.status(200).json({
            success: true,
            data: {
                message: 'Teacher updated successfully',
                teacher: updated,
            },
        });
    }
    // GET /api/v1/admin/users - List all users with filters
    static async listUsers(req, res) {
        const result = await admin_service_1.AdminService.getUsers({
            role: req.query.role,
            is_active: req.query.is_active,
            search: req.query.search,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
        });
        res.json({
            success: true,
            data: result.users,
            meta: result.pagination,
        });
    }
    // PATCH /api/v1/admin/users/:id/status - Activate/Deactivate user
    static async updateUserStatus(req, res) {
        const { id } = req.params;
        const { is_active } = req.body;
        const user = await admin_service_1.AdminService.updateUserStatus(id, is_active);
        res.json({
            success: true,
            data: user,
            message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
        });
    }
    // GET /api/v1/admin/audit-logs - View audit logs
    static async getAuditLogs(req, res) {
        const result = await admin_service_1.AdminService.getAuditLogs({
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
        });
        res.json({
            success: true,
            data: result.logs,
            meta: result.pagination,
        });
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.controller.js.map