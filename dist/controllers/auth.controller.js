"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const types_1 = require("../types");
const auth_service_1 = require("../services/auth.service");
const validation_1 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
class AuthController {
    // POST /api/v1/auth/register
    static async register(req, res) {
        logger_1.default.info({
            userId: req.user?.id,
            email: req.user?.email,
            body: req.body
        }, '🔵 Registration request received');
        const { name, role } = validation_1.registerSchema.parse(req.body);
        // If creating an admin user, require a secret header to prevent abuse
        if (role === 'admin') {
            const adminSecret = process.env.ADMIN_CREATION_SECRET;
            const provided = req.headers['x-admin-secret'] || '';
            if (!adminSecret) {
                throw new types_1.AppError(500, 'Admin creation not configured on server', 'ADMIN_CREATION_NOT_CONFIGURED');
            }
            if (!provided || provided !== adminSecret) {
                throw new types_1.AppError(403, 'Invalid admin creation secret', 'FORBIDDEN');
            }
        }
        const result = await auth_service_1.AuthService.register(req.user.id, req.user.email, name, role);
        logger_1.default.info({
            userId: req.user.id,
            role,
            name
        }, '✅ Profile created successfully');
        res.status(201).json({
            success: true,
            data: {
                message: 'Profile created successfully',
                profile: result.profile,
                email: result.email,
                name: result.name,
            },
        });
    }
    // GET /api/v1/auth/me
    static async getCurrentUser(req, res) {
        const profile = await auth_service_1.AuthService.getCurrentUser(req.user.id);
        res.json({
            success: true,
            data: profile,
        });
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map