"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherOnboardingController = void 0;
const teacher_onboarding_service_1 = require("../services/teacher-onboarding.service");
const validation_1 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
class TeacherOnboardingController {
    // POST /api/v1/teachers/onboarding - Complete onboarding with all data
    static async completeOnboarding(req, res) {
        logger_1.default.info({ userId: req.user?.id }, '🔵 Completing teacher onboarding...');
        const data = validation_1.teacherCompleteOnboardingSchema.parse(req.body);
        const result = await teacher_onboarding_service_1.TeacherOnboardingService.completeOnboarding(req.user.id, data);
        logger_1.default.info({ userId: req.user?.id }, '✅ Teacher onboarding completed successfully');
        res.status(201).json({
            success: true,
            data: {
                message: 'Onboarding completed successfully',
                teacher: result,
            },
        });
    }
    // GET /api/v1/teachers/onboarding - Fetch full onboarding data
    static async getOnboardingData(req, res) {
        logger_1.default.info({ userId: req.user?.id }, '🔵 Fetching onboarding data');
        const result = await teacher_onboarding_service_1.TeacherOnboardingService.getOnboardingData(req.user.id);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
}
exports.TeacherOnboardingController = TeacherOnboardingController;
//# sourceMappingURL=teacher-onboarding.controller.js.map