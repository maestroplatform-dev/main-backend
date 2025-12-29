"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("../controllers/teacher.controller");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
// Public routes
router.get('/', (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getAllTeachers));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getTeacherById));
// Protected routes (require authentication)
router.post('/onboard', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.onboard));
router.get('/profile/me', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getOwnProfile));
router.put('/profile', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.updateProfile));
exports.default = router;
//# sourceMappingURL=teachers.routes.js.map