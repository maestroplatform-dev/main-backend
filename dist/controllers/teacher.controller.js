"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherController = void 0;
const teacher_service_1 = require("../services/teacher.service");
const validation_1 = require("../utils/validation");
class TeacherController {
    // POST /api/v1/teachers/onboard
    static async onboard(req, res) {
        const data = validation_1.teacherOnboardingSchema.parse(req.body);
        const teacher = await teacher_service_1.TeacherService.onboard(req.user.id, data);
        res.status(201).json({
            success: true,
            data: {
                message: 'Teacher onboarding completed',
                teacher,
            },
        });
    }
    // GET /api/v1/teachers/profile (own profile)
    static async getOwnProfile(req, res) {
        const teacher = await teacher_service_1.TeacherService.getProfile(req.user.id);
        res.json({
            success: true,
            data: teacher,
        });
    }
    // GET /api/v1/teachers/:id (public)
    static async getTeacherById(req, res) {
        const teacher = await teacher_service_1.TeacherService.getProfile(req.params.id);
        res.json({
            success: true,
            data: teacher,
        });
    }
    // PUT /api/v1/teachers/profile
    static async updateProfile(req, res) {
        const data = validation_1.teacherProfileUpdateSchema.parse(req.body);
        const teacher = await teacher_service_1.TeacherService.updateProfile(req.user.id, data);
        res.json({
            success: true,
            data: {
                message: 'Profile updated successfully',
                teacher,
            },
        });
    }
    // GET /api/v1/teachers (public - list all)
    static async getAllTeachers(req, res) {
        const verified = req.query.verified === 'true';
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const teachers = await teacher_service_1.TeacherService.getAllTeachers({
            verified,
            limit,
            offset,
        });
        res.json({
            success: true,
            data: teachers,
            meta: {
                limit,
                offset,
                count: teachers.length,
            },
        });
    }
}
exports.TeacherController = TeacherController;
//# sourceMappingURL=teacher.controller.js.map