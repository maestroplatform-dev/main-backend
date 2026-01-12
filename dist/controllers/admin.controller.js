"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const admin_service_1 = require("../services/admin.service");
const validation_1 = require("../utils/validation");
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