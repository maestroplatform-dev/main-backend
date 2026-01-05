"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const supabase_1 = require("../config/supabase");
const database_1 = __importDefault(require("../config/database"));
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = require("crypto");
class AuthService {
    // Validate Supabase token and get user
    static async validateToken(token) {
        const { data: { user }, error, } = await supabase_1.supabase.auth.getUser(token);
        if (error || !user) {
            throw new types_1.AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
        }
        return user;
    }
    // Register user - create profile
    static async register(userId, email, name, role) {
        // Check if profile already exists
        const existing = await database_1.default.profiles.findUnique({
            where: { id: userId },
        });
        if (existing) {
            throw new types_1.AppError(409, 'Profile already exists', 'PROFILE_EXISTS');
        }
        // Create profile
        const profile = await database_1.default.profiles.create({
            data: {
                id: userId,
                name,
                role,
                is_active: true,
            },
        });
        // If teacher, create teacher record
        if (role === 'teacher') {
            await database_1.default.teachers.create({
                data: {
                    id: userId,
                    name,
                    verified: false,
                },
            });
        }
        // If student, create student record
        if (role === 'student') {
            await database_1.default.students.create({
                data: {
                    id: userId,
                    name,
                },
            });
        }
        // Audit log for admin creation
        if (role === 'admin') {
            try {
                const auditId = (0, crypto_1.randomUUID)();
                await database_1.default.audit_log_entries.create({
                    data: {
                        id: auditId,
                        instance_id: null,
                        payload: {
                            action: 'create_admin',
                            userId,
                            email,
                            timestamp: new Date().toISOString(),
                        },
                        ip_address: '',
                    },
                });
            }
            catch (e) {
                // Log but do not block creation on audit failures
                logger_1.default.error('Failed to write admin audit log');
            }
        }
        return { profile, email, name };
    }
    // Get current user profile
    static async getCurrentUser(userId) {
        const profile = await database_1.default.profiles.findUnique({
            where: { id: userId },
            include: {
                students: true,
                teachers: true,
            },
        });
        if (!profile) {
            throw new types_1.AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
        }
        return profile;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map