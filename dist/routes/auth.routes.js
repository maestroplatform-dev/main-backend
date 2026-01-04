"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../utils/asyncHandler");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// POST /api/v1/auth/register - Create profile after Supabase signup (token only, no profile required)
router.post('/register', rateLimiter_1.authLimiter, auth_1.validateSupabaseToken, (0, asyncHandler_1.asyncHandler)(auth_controller_1.AuthController.register));
// GET /api/v1/auth/me - Get current user (requires profile)
router.get('/me', rateLimiter_1.authLimiter, auth_1.authenticateUser, (0, asyncHandler_1.asyncHandler)(auth_controller_1.AuthController.getCurrentUser));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map