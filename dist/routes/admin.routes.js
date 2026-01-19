"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
// Dashboard statistics
router.get('/stats', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.getDashboardStats));
// Teacher management
router.get('/teachers', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.listTeachers));
router.get('/teachers/:id/onboarding', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.getTeacherOnboardingData));
router.get('/teachers/:id', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.getTeacherDetails));
router.put('/teachers/:id', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.updateTeacherDetails));
router.patch('/teachers/:id/verify', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.updateTeacherVerification));
router.post('/teachers/register', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.registerTeacher));
// User management
router.get('/users', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.listUsers));
router.patch('/users/:id/status', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.updateUserStatus));
// Package card configuration
router.get('/package-card-templates', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.listPackageCardTemplates));
router.put('/package-card-templates/:level', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.upsertPackageCardTemplate));
router.put('/students/:id/package-card', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.updateStudentPackageCard));
// Audit logs
router.get('/audit-logs', rateLimiter_1.apiLimiter, auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.getAuditLogs));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map