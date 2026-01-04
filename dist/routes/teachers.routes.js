"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const teacher_controller_1 = require("../controllers/teacher.controller");
const teacher_onboarding_controller_1 = require("../controllers/teacher-onboarding.controller");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
// Protected routes (require authentication + teacher role)
// Specific routes must come BEFORE dynamic :id routes
// Onboarding endpoints (specific routes first)
router.post('/onboarding', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_onboarding_controller_1.TeacherOnboardingController.completeOnboarding));
router.get('/onboarding', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_onboarding_controller_1.TeacherOnboardingController.getOnboardingData));
// Old onboarding route (kept for compatibility)
router.post('/onboard', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.onboard));
// Profile routes
router.get('/profile/me', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getOwnProfile));
router.put('/profile', auth_1.authenticateUser, (0, auth_1.requireRole)('teacher'), (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.updateProfile));
// Public routes (must come LAST - after all protected routes)
router.get('/', (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getAllTeachers));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(teacher_controller_1.TeacherController.getTeacherById));
exports.default = router;
//# sourceMappingURL=teachers.routes.js.map