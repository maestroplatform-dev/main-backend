"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSupabaseToken = validateSupabaseToken;
exports.authenticateUser = authenticateUser;
exports.requireRole = requireRole;
const supabase_1 = require("../config/supabase");
const database_1 = __importDefault(require("../config/database"));
const types_1 = require("../types");
// Validate Supabase token only (no profile required)
async function validateSupabaseToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new types_1.AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
        }
        const token = authHeader.substring(7);
        const { data: { user }, error, } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            throw new types_1.AppError(401, 'Invalid token', 'INVALID_TOKEN');
        }
        req.user = { id: user.id, email: user.email, role: '' };
        next();
    }
    catch (error) {
        next(error);
    }
}
async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new types_1.AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
        }
        const token = authHeader.substring(7);
        const { data: { user }, error, } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            throw new types_1.AppError(401, 'Invalid token', 'INVALID_TOKEN');
        }
        // Fetch user profile from database
        const profile = await database_1.default.profiles.findUnique({
            where: { id: user.id },
        });
        if (!profile || !profile.is_active) {
            throw new types_1.AppError(403, 'User not found or inactive', 'FORBIDDEN');
        }
        req.user = { id: user.id, email: user.email, role: profile.role };
        next();
    }
    catch (error) {
        next(error);
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new types_1.AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map